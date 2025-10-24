-- Create interview_analyses table
CREATE TABLE IF NOT EXISTS public.interview_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  analysis TEXT NOT NULL,
  strengths TEXT[] NOT NULL,
  areas_for_improvement TEXT[] NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

-- Create feedback_logs table
CREATE TABLE IF NOT EXISTS public.feedback_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_positive BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for interview_analyses
CREATE TRIGGER update_interview_analyses_updated_at
BEFORE UPDATE ON public.interview_analyses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for interview_sessions
CREATE TRIGGER update_interview_sessions_updated_at
BEFORE UPDATE ON public.interview_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle analysis
CREATE OR REPLACE FUNCTION process_interview_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be called by the trigger when status changes to 'pending_analysis'
  -- The actual processing is handled by the API endpoint
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for interview_sessions status changes
CREATE OR REPLACE TRIGGER trigger_process_interview_analysis
AFTER UPDATE OF status ON public.interview_sessions
FOR EACH ROW
WHEN (NEW.status = 'pending_analysis')
EXECUTE FUNCTION process_interview_analysis();

-- Add RLS policies if needed
ALTER TABLE public.interview_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for interview_analyses
CREATE POLICY "Users can view their own interview analyses"
ON public.interview_analyses
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.interview_sessions 
    WHERE user_id = auth.uid()
  )
);

-- Create policies for feedback_logs
CREATE POLICY "Users can view their own feedback logs"
ON public.feedback_logs
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.interview_sessions 
    WHERE user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_interview_analyses_session_id ON public.interview_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_logs_session_id ON public.feedback_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);
