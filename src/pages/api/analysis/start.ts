import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { analyzeWithLLM, trackAnalysisUsage } from '@/lib/llmService';

const router = Router();
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper functions
function calculateSpeakingTime(logs: any[] = []): number {
  const speakingLogs = logs.filter((log: any) => log.type === 'speaking');
  return speakingLogs.reduce((total: number, log: any) => {
    return total + (log.metadata?.duration || 0);
  }, 0);
}

function calculateAverageMetric(logs: any[] = [], metricType: string, defaultValue: number = 0): number {
  const metricLogs = logs.filter((log: any) => log.type === metricType);
  if (metricLogs.length === 0) return defaultValue;
  
  const sum = metricLogs.reduce((total: number, log: any) => {
    return total + (log.metadata?.value || 0);
  }, 0);
  
  return sum / metricLogs.length;
}

function countFeedbackByType(logs: any[] = [], type: string): number {
  return logs.filter((log: any) => log.type === type).length;
}

// Call the actual LLM service
async function callLLMService(data: any) {
  try {
    const result = await analyzeWithLLM(data);
    
    // Track usage
    await trackAnalysisUsage({
      userId: data.session.user_id,
      sessionId: data.session.id,
      model: 'gpt-4',
      tokens: 0 // We don't have exact token count from the API
    });
    
    return result;
  } catch (error) {
    console.error('Error in LLM service:', error);
    return {
      analysis: 'Error generating analysis. Please try again.',
      strengths: [],
      areas_for_improvement: ['Could not generate analysis due to an error'],
      overall_score: 0
    };
  }
}

async function analyzeInterview(sessionId: string) {
  try {
    console.log(`Starting analysis for session: ${sessionId}`);
    
    // 1. Fetch all necessary data for analysis
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select(`
        *,
        interview_questions:interview_questions(
          question,
          category,
          difficulty,
          answer_audio_url,
          answer_transcript
        ),
        feedback_logs:feedback_logs(
          type,
          message,
          is_positive,
          timestamp,
          metadata
        ),
        user_profiles(
          name,
          target_role,
          experience_level,
          skills
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Failed to fetch session data');
    }

    console.log(`Fetched session data for: ${sessionId}`);

    // 2. Get a signed URL for the recording if it exists
    let recordingUrl = session.recording_url;
    if (recordingUrl) {
      try {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from('recordings')
          .createSignedUrl(recordingUrl.split('/').pop() || '', 3600);
        recordingUrl = signedUrl?.signedUrl || recordingUrl;
      } catch (storageError) {
        console.error('Error generating signed URL:', storageError);
        // Continue without the signed URL
      }
    }

    // 3. Calculate metrics from feedback logs
    const feedbackLogs = session.feedback_logs || [];
    const metrics = {
      speaking_time: calculateSpeakingTime(feedbackLogs),
      avg_volume: calculateAverageMetric(feedbackLogs, 'volume'),
      avg_pace: calculateAverageMetric(feedbackLogs, 'pace'),
      eye_contact_score: calculateAverageMetric(feedbackLogs, 'eye_contact', 0.7),
      posture_score: calculateAverageMetric(feedbackLogs, 'posture', 0.7),
      filler_word_count: countFeedbackByType(feedbackLogs, 'filler_word'),
      positive_feedback_count: feedbackLogs.filter((f: any) => f.is_positive).length,
      total_feedback_count: feedbackLogs.length,
    };

    // 4. Prepare data for LLM
    const analysisData = {
      session: {
        id: session.id,
        user_id: session.user_id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_seconds: session.duration_seconds,
        recording_url: recordingUrl,
      },
      user_profile: session.user_profiles?.[0] || {},
      questions: session.interview_questions || [],
      feedback_logs: feedbackLogs,
      metrics
    };

    console.log(`Analyzing interview data for session: ${sessionId}`);

    // 5. Call LLM service
    const analysis = await callLLMService(analysisData);

    // 6. Save the analysis results
    const { error: saveError } = await supabaseAdmin
      .from('interview_analyses')
      .upsert({
        session_id: sessionId,
        analysis: analysis.analysis,
        strengths: analysis.strengths,
        areas_for_improvement: analysis.areas_for_improvement,
        overall_score: analysis.overall_score,
        metrics,
        status: 'completed'
      }, {
        onConflict: 'session_id'
      });

    if (saveError) throw saveError;

    console.log(`Analysis completed for session: ${sessionId}`);

    // 7. Update session status
    await supabaseAdmin
      .from('interview_sessions')
      .update({ 
        status: 'analysis_complete',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return { success: true };

  } catch (error) {
    console.error('Error in analysis process:', error);
    
    // Update status to indicate analysis failure
    await supabaseAdmin
      .from('interview_sessions')
      .update({ 
        status: 'analysis_failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    throw error;
  }
}

// API endpoint to start analysis
router.post('/start', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        error: 'Session ID is required',
        status: 'failed'
      });
    }

    // Verify the session exists and is in the correct state
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .in('status', ['pending_analysis', 'analyzing'])
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ 
        error: 'Session not found or already being processed',
        status: 'failed'
      });
    }

    // If already analyzing, return current status
    if (session.status === 'analyzing') {
      return res.status(200).json({ 
        message: 'Analysis already in progress',
        status: 'analyzing'
      });
    }

    // Update status to 'analyzing'
    const { error: updateError } = await supabaseAdmin
      .from('interview_sessions')
      .update({ 
        status: 'analyzing',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    // Start the analysis in the background
    analyzeInterview(sessionId).catch(console.error);

    return res.status(202).json({ 
      message: 'Analysis started',
      status: 'analyzing'
    });

  } catch (error) {
    console.error('Error in analysis handler:', error);
    return res.status(500).json({ 
      error: 'Failed to start analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
      status: 'failed'
    });
  }
});

export default router;

