import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Check if we have real environment variables
const hasValidConfig = supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey !== 'placeholder-key';
export const supabaseConfigured = hasValidConfig;

if (!hasValidConfig) {
  console.warn('⚠️ Supabase environment variables not configured. Using placeholder values.');
  console.warn('To fix this, create a .env file with:');
}

// Create and export the Supabase client with proper typing
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage,
    storageKey: 'supabase.auth.token',
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web',
    },
  },
});

// User and Resume helpers
export const uploadResume = async (
  userId: string, 
  file: File
): Promise<{ data: { publicUrl: string } | null; error: Error | null }> => {
  try {
    // Generate a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    // Upload the file to storage
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: urlData } = await supabase.storage
      .from('resumes')
      .getPublicUrl(filePath);

    if (!urlData) {
      throw new Error('Failed to get public URL for the uploaded file');
    }

    // Prepare resume data with proper typing
    const resumeData: Database['public']['Tables']['resumes']['Insert'] = {
      user_id: userId,
      file_url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    };

    // Save reference in database
    const { error: dbError } = await (supabase as any)
      .from('resumes')
      .insert([resumeData]);

    if (dbError) throw dbError;
    
    return { 
      data: { 
        publicUrl: urlData.publicUrl 
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Error uploading resume:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to upload resume') 
    };
  }
};
// Get interview analysis by interview ID
export const getInterviewAnalysis = async (interviewId: string) => {
  const { data, error } = await supabase
    .from('interview_analysis')
    .select('*')
    .eq('interview_id', interviewId)
    .single();

  if (error) {
    console.error('Error fetching interview analysis:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('No analysis found for the given interview ID');
  }
  
  return data;
};

// Create a new interview
export const createInterview = async (
  interview: Database['public']['Tables']['interviews']['Insert']
) => {
  const { data, error } = await supabase
    .from('interviews')
    .insert(interview as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating interview:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('No data returned after creating interview');
  }
  
  return data;
};

// Update an existing interview
export const updateInterview = async (
  interviewId: string, 
  updates: Database['public']['Tables']['interviews']['Update']
) => {
  // Create update data with proper typing
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  // Use type assertion to help TypeScript understand the types
  const { data, error } = await (supabase as any)
    .from('interviews')
    .update(updateData)
    .eq('id', interviewId)
    .select()
    .single();

  if (error) {
    console.error('Error updating interview:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('No data returned after updating interview');
  }
  
  return data;
};

// Create a new interview analysis
export const createInterviewAnalysis = async (
  analysis: Database['public']['Tables']['interview_analysis']['Insert']
) => {
  const { data, error } = await supabase
    .from('interview_analysis')
    .insert(analysis as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating interview analysis:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('No data returned after creating interview analysis');
  }
  
  return data;
};