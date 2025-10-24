import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { InterviewAnalysis, InterviewSession } from '@/types/analysis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId || Array.isArray(sessionId)) {
      return res.status(400).json({ error: 'Valid session ID is required' });
    }

    // Get the current session status and analysis
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select(`
        *,
        interview_analyses (*)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    return res.status(200).json({
      status: session.status,
      analysis: session.interview_analyses?.[0] || null
    });

  } catch (error) {
    console.error('Error checking analysis status:', error);
    return res.status(500).json({ error: 'Failed to check analysis status' });
  }
}
