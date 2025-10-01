export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      interviews: {
        Row: {
          id: string
          user_id: string
          title: string
          type: string
          duration: string | null
          score: number | null
          video_url: string | null
          created_at: string | null
          updated_at: string | null
          difficulty_level: string
          interview_type: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          type: string
          duration?: string | null
          score?: number | null
          video_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          difficulty_level?: string
          interview_type?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          type?: string
          duration?: string | null
          score?: number | null
          video_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          difficulty_level?: string
          interview_type?: string
        }
      }
      feedback: {
        Row: {
          id: string
          interview_id: string
          user_id: string
          confidence_score: number | null
          clarity_score: number | null
          eye_contact_score: number | null
          engagement_score: number | null
          speech_rate: number | null
          response_quality: number | null
          answer_structure: number | null
          feedback_text: string[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          interview_id: string
          user_id: string
          confidence_score?: number | null
          clarity_score?: number | null
          eye_contact_score?: number | null
          engagement_score?: number | null
          speech_rate?: number | null
          response_quality?: number | null
          answer_structure?: number | null
          feedback_text?: string[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          interview_id?: string
          user_id?: string
          confidence_score?: number | null
          clarity_score?: number | null
          eye_contact_score?: number | null
          engagement_score?: number | null
          speech_rate?: number | null
          response_quality?: number | null
          answer_structure?: number | null
          feedback_text?: string[] | null
          created_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      settings: {
        Row: {
          id: string
          user_id: string
          theme: string | null
          language: string | null
          notification_preferences: Json | null
          video_settings: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string | null
          language?: string | null
          notification_preferences?: Json | null
          video_settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string | null
          language?: string | null
          notification_preferences?: Json | null
          video_settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
      },
      user_sessions: {
        Row: {
          id: string
          user_id: string
          user_agent: string
          created_at: string
          last_active: string
        }
        Insert: {
          id?: string
          user_id: string
          user_agent: string
          created_at?: string
          last_active?: string
        }
        Update: {
          id?: string
          user_id?: string
          user_agent?: string
          created_at?: string
          last_active?: string
        }
      },
      resumes: {
        Row: {
          id: string
          user_id: string
          file_url: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          file_url: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          file_url?: string
          created_at?: string
          updated_at?: string | null
        }
      },
      interview_analysis: {
        Row: {
          id: string
          interview_id: string
          analysis: Json
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          interview_id: string
          analysis: Json
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          interview_id?: string
          analysis?: Json
          created_at?: string
          updated_at?: string | null
        }
      }
    }
  }
}