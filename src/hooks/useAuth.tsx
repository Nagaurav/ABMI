import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          throw error;
        }
        
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Validate password is not empty
    if (!password || password.trim() === '') {
      throw new Error('Please enter your password');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email before signing in.');
        } else {
          throw error;
        }
      }
      
      if (!data.user) {
        throw new Error('No user data returned from server');
      }
      
      setUser(data.user);
      toast.success('Successfully signed in');
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;
      
      if (!data.user) {
        throw new Error('No user data returned from server');
      }
      
      toast.success('Account created! Please check your email to verify your account.');
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      toast.success('Successfully signed out');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast.success('Password reset email sent. Please check your inbox.');
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) throw error;
      
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 