import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface AnalysisResult {
  analysis: string;
  strengths: string[];
  areas_for_improvement: string[];
  overall_score: number;
}

interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function analyzeWithLLM(data: any): Promise<AnalysisResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  try {
    const prompt = createAnalysisPrompt(data);
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview coach analyzing a mock interview. Provide detailed, constructive feedback.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`LLM API error: ${JSON.stringify(errorData)}`);
    }

    const result: LLMResponse = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in LLM response');
    }

    return parseLLMResponse(content);
  } catch (error) {
    console.error('Error in LLM service:', error);
    throw new Error(`LLM service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createAnalysisPrompt(data: any): string {
  const { session, feedback_logs = [] } = data;
  
  // Format feedback logs for the prompt
  const formattedLogs = feedback_logs.map((log: any) => ({
    timestamp: log.timestamp ? new Date(log.timestamp).toISOString().substr(11, 8) : '00:00',
    transcript_chunk: log.message || '',
    eye_contact: log.metadata?.eye_contact ?? true,
    is_slouching: log.metadata?.posture === 'slouching'
  }));

  return `**Role:** You are an expert interview coach providing a detailed performance analysis for a candidate.

**Task:** Analyze the provided interview data, which includes a timeline of feedback logs and a video recording URL. Provide a comprehensive, constructive, and encouraging report.

**Input Data:**
Here is the interview data in JSON format:
${JSON.stringify({
  feedback_logs: formattedLogs,
  recording_url: session.recording_url || 'No recording available'
}, null, 2)}

**Instructions:**
Based on the input data, perform a holistic analysis and return a valid JSON object. Do not include any text, formatting, or markdown outside of the JSON object itself.

The JSON object must follow this exact structure:
{
  "analysis": "<A detailed, multi-paragraph summary of the candidate's performance, covering both strengths and weaknesses in a constructive tone.>",
  "strengths": [
    "<A concise point about a key strength.>",
    "<Another concise point about a key strength.>"
  ],
  "areas_for_improvement": [
    "<A specific, actionable tip for improvement.>",
    "<Another specific, actionable tip for improvement.>"
  ],
  "overall_score": <An integer score out of 100>
}`;
}

function parseLLMResponse(content: string): AnalysisResult {
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback to parsing as raw text
    const analysisMatch = content.match(/analysis[\s:]+([^\n]+)/i);
    const strengthsMatch = content.match(/strengths?:\s*([^\n]+)/i);
    const improvementsMatch = content.match(/(?:areas for improvement|improvements?)[\s:]+([^\n]+)/i);
    const scoreMatch = content.match(/overall[\s_]*score[\s:]*([0-9]+)/i);
    
    return {
      analysis: analysisMatch ? analysisMatch[1].trim() : 'Analysis not available',
      strengths: strengthsMatch ? strengthsMatch[1].split(',').map(s => s.trim()) : [],
      areas_for_improvement: improvementsMatch ? improvementsMatch[1].split(',').map(s => s.trim()) : [],
      overall_score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0
    };
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    return {
      analysis: 'Error analyzing interview. Please try again.',
      strengths: [],
      areas_for_improvement: [],
      overall_score: 0
    };
  }
}

// Function to track analysis usage
interface AnalysisUsage {
  id: string;
  user_id: string;
  session_id: string;
  model: string;
  tokens_used: number;
  created_at: string;
}

export async function trackAnalysisUsage(params: {
  userId: string;
  sessionId: string;
  model: string;
  tokens: number;
}): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('analysis_usage').insert({
    id: uuidv4(),
    user_id: params.userId,
    session_id: params.sessionId,
    model: params.model,
    tokens_used: params.tokens,
    created_at: new Date().toISOString()
  } as AnalysisUsage);
}
