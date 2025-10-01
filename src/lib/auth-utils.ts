import { supabase } from './supabase';
import { toast } from 'sonner';

type AuthResponse = {
  success: boolean;
  error?: string | null;
  data?: any;
};

export const authUtils = {
  // Sign up with email and password
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
        },
      });

      if (error) throw error;

      return {
        success: true,
        data: data.user,
      };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign up',
      };
    }
  },

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return {
        success: true,
        data: data.user,
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error.message || 'Invalid email or password',
      };
    }
  },

  // Sign out
  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign out',
      };
    }
  },

  // Send password reset email
  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send password reset email',
      };
    }
  },

  // Update user password
  async updatePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Update password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update password',
      };
    }
  },

  // Get current user session
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // Get current user
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  // Handle auth errors
  handleAuthError(error: any) {
    console.error('Auth error:', error);
    
    let message = 'An error occurred during authentication';
    
    if (error.message.includes('Invalid login credentials')) {
      message = 'Invalid email or password';
    } else if (error.message.includes('Email not confirmed')) {
      message = 'Please verify your email before signing in';
    } else if (error.message.includes('User already registered')) {
      message = 'An account with this email already exists';
    } else if (error.message.includes('Password should be at least 6 characters')) {
      message = 'Password must be at least 6 characters long';
    }
    
    toast.error(message);
    return message;
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session?.user;
  },

  // Get user profile
  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update user profile
  async updateProfile(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// Export a hook for easier usage in components
export const useAuth = () => {
  return {
    ...authUtils,
    // Add any additional hooks or context here
  };
};
