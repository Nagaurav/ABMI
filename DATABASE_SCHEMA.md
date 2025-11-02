# Complete Database Schema for ABMI Interview Training Platform

## Overview
This document provides a comprehensive database schema for the ABMI (AI-Based Mock Interview) platform built with Supabase (PostgreSQL). The schema supports user authentication, interview sessions, analysis, feedback, recordings, and dashboard functionality.

---

## Core Tables

### 1. `profiles`
Stores user profile information linked to Supabase Auth users.

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  company TEXT,
  position TEXT,
  location TEXT,
  website TEXT,
  linkedin TEXT,
  github TEXT,
  skills TEXT[],
  target_role TEXT,
  experience_level TEXT CHECK (experience_level IN ('junior', 'mid', 'senior', 'lead')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_id ON profiles(id);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### 2. `interview_sessions`
Main table for tracking interview sessions.

```sql
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'preparing' 
    CHECK (status IN ('preparing', 'in_progress', 'completed', 'pending_analysis', 'analysis_failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  interview_type TEXT DEFAULT 'general',
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  session_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX idx_interview_sessions_created_at ON interview_sessions(created_at DESC);
CREATE INDEX idx_interview_sessions_user_created ON interview_sessions(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON interview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON interview_sessions FOR UPDATE
  USING (auth.uid() = user_id);
```

---

### 3. `interview_questions`
Stores interview questions that can be used in sessions.

```sql
CREATE TABLE IF NOT EXISTS interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  time_limit INTEGER DEFAULT 120, -- in seconds
  answer_transcript TEXT,
  answer_audio_url TEXT,
  answered_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_interview_questions_session_id ON interview_questions(session_id);
CREATE INDEX idx_interview_questions_category ON interview_questions(category);
CREATE INDEX idx_interview_questions_difficulty ON interview_questions(difficulty);

-- RLS Policies
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions from own sessions"
  ON interview_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_questions.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create questions for own sessions"
  ON interview_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_questions.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update questions for own sessions"
  ON interview_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_questions.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );
```

---

### 4. `feedback_logs`
Stores real-time feedback during interview sessions.

```sql
CREATE TABLE IF NOT EXISTS feedback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('eye_contact', 'posture', 'volume', 'pace', 'filler_words', 'confidence', 'clarity')),
  message TEXT NOT NULL,
  is_positive BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feedback_logs_session_id ON feedback_logs(session_id);
CREATE INDEX idx_feedback_logs_type ON feedback_logs(type);
CREATE INDEX idx_feedback_logs_timestamp ON feedback_logs(timestamp DESC);

-- RLS Policies
ALTER TABLE feedback_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback from own sessions"
  ON feedback_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = feedback_logs.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create feedback for own sessions"
  ON feedback_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = feedback_logs.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );
```

---

### 5. `interview_analyses`
Stores comprehensive analysis results after interview completion.

```sql
CREATE TABLE IF NOT EXISTS interview_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE UNIQUE,
  analysis TEXT NOT NULL,
  strengths TEXT[] NOT NULL,
  areas_for_improvement TEXT[] NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  metrics JSONB,
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_interview_analyses_session_id ON interview_analyses(session_id);
CREATE INDEX idx_interview_analyses_overall_score ON interview_analyses(overall_score DESC);

-- RLS Policies
ALTER TABLE interview_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses from own sessions"
  ON interview_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_analyses.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create analyses for own sessions"
  ON interview_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_analyses.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );
```

---

### 6. `recordings`
Stores metadata for interview video/audio recordings.

```sql
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url TEXT,
  audio_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  mime_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recordings_session_id ON recordings(session_id);
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);

-- RLS Policies
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recordings"
  ON recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recordings"
  ON recordings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recordings"
  ON recordings FOR DELETE
  USING (auth.uid() = user_id);
```

---

### 7. `user_settings`
Stores user preferences and application settings.

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{"email": true, "interviewReminders": true, "performanceReports": true}'::jsonb,
  video_settings JSONB DEFAULT '{"resolution": "1080p", "noise_cancellation": true}'::jsonb,
  audio_settings JSONB DEFAULT '{"volume": 100, "mute_microphone": false}'::jsonb,
  feedback_sensitivity INTEGER DEFAULT 3 CHECK (feedback_sensitivity >= 1 AND feedback_sensitivity <= 5),
  ai_voice_gender TEXT DEFAULT 'neutral' CHECK (ai_voice_gender IN ('male', 'female', 'neutral')),
  app_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- RLS Policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id);
```

---

### 8. `custom_modes`
Stores user-created custom interview modes/presets.

```sql
CREATE TABLE IF NOT EXISTS custom_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  interview_type TEXT NOT NULL,
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  question_categories TEXT[],
  duration_minutes INTEGER DEFAULT 30,
  settings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_custom_modes_user_id ON custom_modes(user_id);
CREATE INDEX idx_custom_modes_active ON custom_modes(is_active);

-- RLS Policies
ALTER TABLE custom_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own custom modes"
  ON custom_modes FOR ALL
  USING (auth.uid() = user_id);
```

---

### 9. `resumes`
Stores uploaded resume files and metadata.

```sql
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT,
  extracted_text TEXT,
  parsed_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_created_at ON resumes(created_at DESC);

-- RLS Policies
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own resumes"
  ON resumes FOR ALL
  USING (auth.uid() = user_id);
```

---

### 10. `analysis_usage`
Tracks LLM API usage for billing/analytics.

```sql
CREATE TABLE IF NOT EXISTS analysis_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE SET NULL,
  llm_provider TEXT DEFAULT 'openai',
  model_name TEXT,
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 4),
  analysis_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analysis_usage_user_id ON analysis_usage(user_id);
CREATE INDEX idx_analysis_usage_session_id ON analysis_usage(session_id);
CREATE INDEX idx_analysis_usage_created_at ON analysis_usage(created_at DESC);

-- RLS Policies
ALTER TABLE analysis_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON analysis_usage FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Functions and Triggers

### Auto-update `updated_at` timestamp

```sql
-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at
  BEFORE UPDATE ON interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_questions_updated_at
  BEFORE UPDATE ON interview_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_analyses_updated_at
  BEFORE UPDATE ON interview_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_modes_updated_at
  BEFORE UPDATE ON custom_modes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resumes_updated_at
  BEFORE UPDATE ON resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Dashboard Function - Get Performance History

```sql
CREATE OR REPLACE FUNCTION get_performance_history(
  user_id_param UUID,
  limit_count INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(ia.created_at) as date,
    AVG(ia.overall_score)::NUMERIC as score
  FROM interview_analyses ia
  INNER JOIN interview_sessions s ON ia.session_id = s.id
  WHERE s.user_id = user_id_param
    AND s.status = 'completed'
    AND ia.overall_score IS NOT NULL
  GROUP BY DATE(ia.created_at)
  ORDER BY date DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Dashboard Function - Calculate User Statistics

```sql
CREATE OR REPLACE FUNCTION get_user_dashboard_stats(
  user_id_param UUID
)
RETURNS TABLE (
  interviews_completed BIGINT,
  average_score NUMERIC,
  latest_improvement_area TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') as interviews_completed,
    COALESCE(AVG(ia.overall_score), 0)::NUMERIC as average_score,
    (
      SELECT STRING_AGG(DISTINCT UNNEST(ia2.areas_for_improvement), ', ')
      FROM interview_analyses ia2
      INNER JOIN interview_sessions s2 ON ia2.session_id = s2.id
      WHERE s2.user_id = user_id_param
      ORDER BY ia2.created_at DESC
      LIMIT 1
    ) as latest_improvement_area
  FROM interview_sessions s
  LEFT JOIN interview_analyses ia ON s.id = ia.session_id
  WHERE s.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Storage Buckets

### 1. `interview-recordings`
Stores video/audio recordings of interviews.

```sql
-- Create storage bucket (run in Supabase Dashboard SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-recordings', 'interview-recordings', false);

-- Storage Policies
CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'interview-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'interview-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'interview-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

### 2. `resumes`
Stores uploaded resume PDFs.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

-- Storage Policies
CREATE POLICY "Users can manage own resumes"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'resumes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Indexes Summary

```sql
-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_sessions_user_status 
  ON interview_sessions(user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_sessions_user_created 
  ON interview_sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_logs_session_timestamp 
  ON feedback_logs(session_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interview_analyses_score 
  ON interview_analyses(overall_score DESC);
```

---

## Views (Optional)

### User Dashboard View

```sql
CREATE OR REPLACE VIEW user_dashboard_view AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') as interviews_completed,
  COALESCE(AVG(ia.overall_score), 0)::NUMERIC(5,2) as average_score,
  (
    SELECT STRING_AGG(DISTINCT UNNEST(ia2.areas_for_improvement), ', ')
    FROM interview_analyses ia2
    INNER JOIN interview_sessions s2 ON ia2.session_id = s2.id
    WHERE s2.user_id = p.id
    ORDER BY ia2.created_at DESC
    LIMIT 1
  ) as latest_improvement_area
FROM profiles p
LEFT JOIN interview_sessions s ON p.id = s.user_id
LEFT JOIN interview_analyses ia ON s.id = ia.session_id
GROUP BY p.id, p.full_name, p.email;
```

---

## Migration Order

1. Create `profiles` table
2. Create `interview_sessions` table
3. Create `interview_questions` table
4. Create `feedback_logs` table
5. Create `interview_analyses` table
6. Create `recordings` table
7. Create `user_settings` table
8. Create `custom_modes` table
9. Create `resumes` table
10. Create `analysis_usage` table
11. Create functions and triggers
12. Create storage buckets and policies
13. Create indexes
14. Create views (optional)

---

## Notes

- All tables use UUIDs as primary keys for better distribution and security
- Row Level Security (RLS) is enabled on all tables
- All foreign keys use `ON DELETE CASCADE` to maintain data integrity
- Timestamps use `TIMESTAMPTZ` for timezone-aware storage
- JSONB columns are used for flexible metadata storage
- Indexes are created for common query patterns
- Security is handled through RLS policies based on `auth.uid()`

