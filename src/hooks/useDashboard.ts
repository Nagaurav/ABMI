import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface PerformanceDataPoint {
  date: string;
  score: number;
}

export interface InterviewHistoryItem {
  session_id: string;
  date: string;
  score: number;
}

export interface DashboardData {
  full_name: string;
  email: string;
  interviews_completed: number;
  average_score: number;
  latest_improvement_area: string;
  performance_history: PerformanceDataPoint[];
  interview_history: InterviewHistoryItem[];
}

interface UseDashboardReturn {
  userData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const [userData, setUserData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchDashboardData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch user profile data
      // Use proper type from database schema
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name,email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        // If it's a 406 error (Not Acceptable) or 404 (Not Found), it might be an RLS issue or missing profile
        // In these cases, we'll continue with default values instead of failing completely
        const statusCode = (profileError as any).status || (profileError as any).code;
        if (statusCode === 406 || statusCode === 404 || profileError.code === 'PGRST116') {
          console.warn('Profile not found or access denied (status:', statusCode, '). Using default values.');
          // Continue with default values instead of throwing
        } else {
          throw profileError;
        }
      }

      // If no profile exists, use default values
      const fullName = profileData?.full_name || user.email?.split('@')[0] || 'User';
      const email = profileData?.email || user.email || '';

      let sessions: any[] = [];
      let sessionsError: any = null;

      try {
        // First, check if the table exists by making a test query
        const { data: testData, error: testError } = await supabase
          .from('interview_sessions')
          .select('id')
          .limit(1);

        if (testError) throw testError;

        // If table exists, fetch the actual data
        console.log('Fetching interview sessions for user:', user.id);
        const { data, error } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        console.log('Interview sessions response:', { data, error });
        
        if (error) throw error;
        sessions = data || [];
      } catch (err: any) {
        console.error('Error fetching interview sessions:', err);
        sessionsError = err;
        
        // If it's a 404, the table might not exist or have a different name
        if (err.message && err.message.includes('404')) {
          throw new Error('The interview sessions table was not found. Please check if the table name is correct or create the table in your Supabase database.');
        }
        
        throw err;
      }
      
      // If no sessions, return empty data
      if (!sessions || sessions.length === 0) {
        console.log('No interview sessions found for user:', user.id);
        const dashboardData: DashboardData = {
          full_name: fullName,
          email: email,
          interviews_completed: 0,
          average_score: 0,
          latest_improvement_area: 'Start practicing to see your metrics',
          performance_history: [],
          interview_history: [],
        };
        setUserData(dashboardData);
        setIsLoading(false);
        return;
      }

      // Type assertion for sessions
      const typedSessions = sessions as unknown as Array<{
        id: string;
        created_at: string;
        duration_seconds?: number;
        score?: number;
        status?: string;
        // Add other fields from your interview_sessions table
      }>;

      // Calculate metrics with proper null checks
      const completedSessions = typedSessions.filter(s => s.status === 'completed');
      const totalScore = completedSessions.reduce(
        (sum, session) => sum + (typeof session.score === 'number' ? session.score : 0), 
        0
      );
      
      const averageScore = completedSessions.length > 0 
        ? Math.round((totalScore / completedSessions.length) * 10) / 10 
        : 0;

      // Format interview history with proper null checks
      const interviewHistory: InterviewHistoryItem[] = typedSessions.map(session => ({
        session_id: session.id,
        date: session.created_at ? new Date(session.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        score: typeof session.score === 'number' ? session.score : 0,
      }));

      // Generate performance history (last 7 days)
      const performanceHistory: PerformanceDataPoint[] = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Calculate average score for this day
        const daySessions = typedSessions.filter(s => {
          if (!s.created_at) return false;
          const sessionDate = new Date(s.created_at).toISOString().split('T')[0];
          return sessionDate === dateStr && s.status === 'completed';
        });
        
        const dayScore = daySessions.length > 0
          ? daySessions.reduce((sum, s) => sum + (typeof s.score === 'number' ? s.score : 0), 0) / daySessions.length
          : 0;
        
        performanceHistory.push({
          date: dateStr,
          score: Math.round(dayScore * 10) / 10,
        });
      }

      // Determine latest improvement area (simplified - you may want to enhance this)
      const latestImprovementArea = completedSessions.length > 0
        ? 'Continue practicing to improve your scores'
        : 'Start practicing to see your metrics';

      // Build the dashboard data
      const dashboardData: DashboardData = {
        full_name: fullName,
        email: email,
        interviews_completed: completedSessions.length,
        average_score: averageScore,
        latest_improvement_area: latestImprovementArea,
        performance_history: performanceHistory,
        interview_history: interviewHistory,
      };

      setUserData(dashboardData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  return {
    userData,
    isLoading,
    error,
    refetch: fetchDashboardData,
  };
}