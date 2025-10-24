import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Create authenticated Supabase client
    const supabase = createServerSupabaseClient({ req, res });
    
    // Get the user from the session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = session.user.id;

    // Get user's full name from profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({ message: 'Error fetching user profile' });
    }

    // Get KPIs
    const { data: kpiData, error: kpiError } = await supabase
      .rpc('get_dashboard_kpis', { user_id: userId })
      .single();

    if (kpiError) {
      console.error('Error fetching KPIs:', kpiError);
      return res.status(500).json({ message: 'Error fetching dashboard KPIs' });
    }

    // Get performance history (last 10 interviews)
    const { data: performanceData, error: performanceError } = await supabase
      .rpc('get_performance_history', { user_id: userId, limit_count: 10 });

    if (performanceError) {
      console.error('Error fetching performance history:', performanceError);
      return res.status(500).json({ message: 'Error fetching performance history' });
    }

    // Get recent interview sessions
    const { data: interviewHistory, error: historyError } = await supabase
      .rpc('get_recent_interviews', { user_id: userId, limit_count: 5 });

    if (historyError) {
      console.error('Error fetching interview history:', historyError);
      return res.status(500).json({ message: 'Error fetching interview history' });
    }

    // Format the response
    const response = {
      full_name: profileData.full_name,
      email: profileData.email,
      interviews_completed: kpiData.interviews_completed || 0,
      average_score: kpiData.average_score || 0,
      latest_improvement_area: kpiData.latest_improvement_area || 'N/A',
      performance_history: performanceData || [],
      interview_history: interviewHistory || [],
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in dashboard summary API:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
