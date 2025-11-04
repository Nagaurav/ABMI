import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the session data
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('interview_sessions')
      .select('*, user_id, recording_url, created_at')
      .eq('id', sessionId)
      .single()

    if (sessionError) throw sessionError
    if (!sessionData) throw new Error('Session not found')

    // Get all feedback logs for this session
    const { data: feedbackLogs, error: feedbackError } = await supabaseClient
      .from('feedback_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })

    if (feedbackError) throw feedbackError

    // Get the transcript (assuming it's stored in the session or recordings table)
    const { data: recordingData, error: recordingError } = await supabaseClient
      .from('recordings')
      .select('transcript')
      .eq('session_id', sessionId)
      .single()

    if (recordingError) {
      console.warn('No transcript found, proceeding without it:', recordingError.message)
    }

    const transcript = recordingData?.transcript || ''

    // Call Gemini API for analysis
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set')
    }

    // Prepare the prompt for Gemini
    const prompt = createGeminiPrompt(transcript, feedbackLogs)

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    )

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text()
      throw new Error(`Gemini API error: ${error}`)
    }

    const geminiData = await geminiResponse.json()
    const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!analysisText) {
      throw new Error('Invalid response from Gemini API')
    }

    // Parse the JSON response from Gemini
    let analysisJson
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = analysisText.match(/```(?:json)?\n([\s\S]*?)\n```/)
      analysisJson = JSON.parse(jsonMatch ? jsonMatch[1] : analysisText)
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e)
      throw new Error('Failed to parse analysis results')
    }

    // Save the analysis to the database
    const { data: analysisData, error: analysisError } = await supabaseClient
      .from('interview_analyses')
      .upsert({
        session_id: sessionId,
        user_id: sessionData.user_id,
        analysis: analysisJson.analysis || '',
        strengths: analysisJson.strengths || [],
        areas_for_improvement: analysisJson.areas_for_improvement || [],
        overall_score: analysisJson.overall_score || 0,
        metrics: analysisJson.metrics || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (analysisError) throw analysisError

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in analyze-session function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred during analysis',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Helper function to create the prompt for Gemini
function createGeminiPrompt(transcript: string, feedbackLogs: any[]): string {
  // Group feedback by type
  const feedbackByType: Record<string, any[]> = {}
  feedbackLogs.forEach((log) => {
    if (!feedbackByType[log.type]) {
      feedbackByType[log.type] = []
    }
    feedbackByType[log.type].push(log)
  })

  // Format the feedback for the prompt
  const formattedFeedback = Object.entries(feedbackByType)
    .map(([type, logs]) => {
      return `- ${type.toUpperCase()}: ${logs.length} instances, e.g. "${logs[0].message}"`
    })
    .join('\n')

  return `You are an AI career coach analyzing a mock interview. Below is the transcript of the interview and feedback collected during the session.

TRANSCRIPT:
${transcript || 'No transcript available'}

FEEDBACK COLLECTED DURING INTERVIEW:
${formattedFeedback}

Please analyze this interview and provide a detailed report in the following JSON format:

{
  "analysis": "A detailed analysis of the candidate's performance, including communication skills, technical knowledge, and overall impression.",
  "strengths": ["List 3-5 key strengths", "Be specific and reference the transcript/feedback"],
  "areas_for_improvement": ["List 3-5 areas to improve", "Be specific and provide actionable advice"],
  "overall_score": 75, // A score from 0-100
  "metrics": {
    "communication": 0-10,
    "technical_skills": 0-10,
    "problem_solving": 0-10,
    "confidence": 0-10
  }
}

Your analysis should be professional, constructive, and focused on helping the candidate improve.`
}
