/*
  # Dashboard Enhancements Migration
  
  This migration adds necessary columns and structures to support the dashboard functionality.
  
  1. Changes to existing tables:
    - Add `session_date` column to interviews table (for tracking when interview was conducted)
    - Add `status` column to interviews table (for tracking completion status)
    - Add `overall_score` column to feedback table (for quick access to main score)
    - Add `key_improvement_area` column to feedback table (for dashboard display)
    
  2. New indexes for performance:
    - Index on interviews.user_id and created_at for faster dashboard queries
    - Index on feedback.user_id for aggregation queries
*/

-- Add session_date to interviews table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interviews' AND column_name = 'session_date'
  ) THEN
    ALTER TABLE interviews
    ADD COLUMN session_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Add status to interviews table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'interviews' AND column_name = 'status'
  ) THEN
    ALTER TABLE interviews
    ADD COLUMN status text DEFAULT 'completed' NOT NULL
    CHECK (status IN ('pending', 'in_progress', 'completed', 'pending_analysis'));
  END IF;
END $$;

-- Add overall_score to feedback table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback' AND column_name = 'overall_score'
  ) THEN
    ALTER TABLE feedback
    ADD COLUMN overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100);
  END IF;
END $$;

-- Add key_improvement_area to feedback table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback' AND column_name = 'key_improvement_area'
  ) THEN
    ALTER TABLE feedback
    ADD COLUMN key_improvement_area text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_interviews_user_created 
  ON interviews(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interviews_user_session_date 
  ON interviews(user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user 
  ON feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_interview 
  ON feedback(interview_id);

-- Update existing feedback records to calculate overall_score if null
-- This is a one-time data migration
UPDATE feedback
SET overall_score = (
  COALESCE(confidence_score, 0) + 
  COALESCE(clarity_score, 0) + 
  COALESCE(response_quality, 0) + 
  COALESCE(answer_structure, 0)
) / 4
WHERE overall_score IS NULL
AND (confidence_score IS NOT NULL OR clarity_score IS NOT NULL OR response_quality IS NOT NULL OR answer_structure IS NOT NULL);

-- Create a function to automatically calculate overall_score
CREATE OR REPLACE FUNCTION calculate_overall_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate overall score as average of available scores
  NEW.overall_score := (
    COALESCE(NEW.confidence_score, 0) + 
    COALESCE(NEW.clarity_score, 0) + 
    COALESCE(NEW.response_quality, 0) + 
    COALESCE(NEW.answer_structure, 0) + 
    COALESCE(NEW.engagement_score, 0) + 
    COALESCE(NEW.eye_contact_score, 0)
  ) / 6;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate overall_score on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_overall_score ON feedback;
CREATE TRIGGER trigger_calculate_overall_score
  BEFORE INSERT OR UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION calculate_overall_score();

-- Add comment to tables for documentation
COMMENT ON COLUMN interviews.session_date IS 'The date when the interview was conducted';
COMMENT ON COLUMN interviews.status IS 'Current status of the interview session';
COMMENT ON COLUMN feedback.overall_score IS 'Calculated average score across all feedback metrics';
COMMENT ON COLUMN feedback.key_improvement_area IS 'Primary area identified for improvement by the LLM';
