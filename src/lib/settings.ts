import { supabase } from './supabase';
import type { Database } from './database.types';

export type UserSettings = Database['public']['Tables']['user_settings']['Row'];

/**
 * Get user settings from the database
 * If no settings exist, returns default settings
 */
export const getUserSettings = async (userId: string): Promise<UserSettings> => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching settings:', error);
    throw error;
  }
  
  // Return default settings if no settings exist
  return data || {
    id: userId,
    theme: 'light',
    language: 'en',
    sound_effects: true,
    notifications_enabled: true,
    email_notifications: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Update user settings
 * Creates a new record if it doesn't exist
 */
export const updateUserSettings = async (
  userId: string, 
  updates: Partial<Omit<UserSettings, 'id' | 'created_at' | 'updated_at'>>
): Promise<UserSettings> => {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating settings:', error);
    throw error;
  }

  return data;
};

/**
 * Get theme preference for the current user
 */
export const getUserTheme = async (userId: string): Promise<'light' | 'dark'> => {
  const { data } = await supabase
    .from('user_settings')
    .select('theme')
    .eq('id', userId)
    .single();
    
  return data?.theme || 'light';
};
