import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// Define the shape of the profile from Supabase
interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  bio?: string;  // Added bio field since it exists in your database
}

export interface PerformanceDataPoint {
  date: string;
  score: number;
}

export interface InterviewHistoryItem {
  interview_session_id: string;
  date: string;
  duration: number; // in seconds
  score: number;
  status: string;
}

export interface DashboardData {
  name: string;
  email: string;
  averageScore: number;
  interviewsCompleted: number;
  keyImprovementArea: string;
  performanceHistory: PerformanceDataPoint[];
  interviewHistory: InterviewHistoryItem[];
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

      // Fetch user profile data with type assertion
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single<Profile>();

      if (profileError) throw profileError;
      if (!profileData) throw new Error('Profile not found');

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
          name: profileData.full_name || 'User',
          email: profileData.email || user?.email || '',
          averageScore: 0,
          interviewsCompleted: 0,
          keyImprovementArea: 'Start practicing to see your metrics',
          performanceHistory: [],
          interviewHistory: [],
        };
        setUserData(dashboardData);
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
        interview_session_id: session.id,
        date: session.created_at ? new Date(session.created_at).toISOString() : new Date().toISOString(),
        duration: typeof session.duration_seconds === 'number' ? session.duration_seconds : 0,
        score: typeof session.score === 'number' ? session.score : 0,
        status: session.status || 'completed'
      }));

      // Generate performance history (last 7 days)
      const performanceHistory: PerformanceDataPoint[] = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const daySessions = completedSessions.filter(s => {
          const sessionDate = s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : '';
          return sessionDate === dateStr;
        });
        
        const dayScore = daySessions.length > 0
          ? daySessions.reduce((sum, s) => sum + (typeof s.score === 'number' ? s.score : 0), 0) / daySessions.length
          : 0;
          
        performanceHistory.push({
          date: dateStr,
          score: Math.round(dayScore * 10) / 10
        });
      }

      // Determine key improvement area (simplified example)
      let keyImprovementArea = 'Communication Skills';
      if (averageScore < 5) {
        keyImprovementArea = 'Technical Knowledge';
      } else if (averageScore < 7) {
        keyImprovementArea = 'Problem Solving';
      }

      // Construct the dashboard data with proper null checks
      const dashboardData: DashboardData = {
        name: profileData.full_name || 'User',
        email: profileData.email || user?.email || '',
        averageScore,
        interviewsCompleted: completedSessions.length,
        keyImprovementArea,
        performanceHistory,
        interviewHistory,
      };

      setUserData(dashboardData);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
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