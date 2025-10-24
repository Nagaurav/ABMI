export interface InterviewAnalysis {
  id: string;
  session_id: string;
  analysis: string;
  strengths: string[];
  areas_for_improvement: string[];
  overall_score: number;
  created_at: string;
  updated_at: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  status: 'pending_analysis' | 'analyzing' | 'analysis_complete' | 'analysis_failed';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackLog {
  id: string;
  session_id: string;
  type: string;
  message: string;
  is_positive: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}
