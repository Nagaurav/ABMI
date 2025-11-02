import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';
import {
  User,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface FormData {
  name: string;
  email: string;
  bio: string;
  skills: string[];
  github_profile: string;
  linkedin_profile: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    bio: '',
    skills: [],
    github_profile: '',
    linkedin_profile: '',
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    console.log('[Profile] loadProfile called', { userId: user?.id, email: user?.email, supabaseConfigured });
    
    if (!user || !supabaseConfigured) {
      console.warn('[Profile] User or Supabase not configured, using mock data');
      // Mock data fallback
      setFormData({
        name: 'John Doe',
        email: user?.email || 'user@example.com',
        bio: 'Aspiring software engineer passionate about building delightful products.',
        skills: ['React', 'TypeScript', 'Node.js'],
        github_profile: 'https://github.com/username',
        linkedin_profile: 'https://linkedin.com/in/username',
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[Profile] Fetching profile from Supabase', { userId: user.id });
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[Profile] Profile fetch result', { profile, profileError });

      if (profileError) {
        console.log('[Profile] Profile error detected', { 
          code: profileError.code, 
          message: profileError.message,
          details: profileError 
        });
        
        // If profile doesn't exist, create one
        if (profileError.code === 'PGRST116') {
          console.log('[Profile] Profile not found, creating new profile');
          const { error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              full_name: user.email?.split('@')[0] || 'User',
            });

          if (createError) {
            console.error('[Profile] Error creating profile:', createError);
            throw createError;
          }
          
          console.log('[Profile] Profile created successfully');
          // Set form data after successful creation
          setFormData({
            name: user.email?.split('@')[0] || 'User',
            email: user.email || '',
            bio: '',
            skills: [],
            github_profile: '',
            linkedin_profile: '',
          });
          setLoading(false);
          return;
        }
        console.error('[Profile] Unhandled profile error:', profileError);
        throw profileError;
      }

      // Profile exists, set form data
      if (!profile) {
        console.log('[Profile] No profile data returned, using defaults');
        setFormData({
          name: user.email?.split('@')[0] || 'User',
          email: user.email || '',
          bio: '',
          skills: [],
          github_profile: '',
          linkedin_profile: '',
        });
        setLoading(false);
        return;
      }

      console.log('[Profile] Profile loaded successfully', { 
        id: profile.id,
        email: (profile as any)?.email,
        full_name: (profile as any)?.full_name,
        bio: (profile as any)?.bio 
      });

      setFormData({
        name: (profile as any)?.full_name || user.email?.split('@')[0] || '',
        email: (profile as any)?.email || user.email || '',
        bio: (profile as any)?.bio || '',
        skills: [], // Skills not in profiles table schema
        github_profile: '', // Not in profiles table schema
        linkedin_profile: '', // Not in profiles table schema
      });
    } catch (err) {
      console.error('[Profile] Error loading profile:', err);
      setError('Failed to load profile');
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
      console.log('[Profile] loadProfile completed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Profile] handleSubmit called', { 
      userId: user?.id, 
      formData,
      supabaseConfigured 
    });

    if (!user || !supabaseConfigured) {
      console.warn('[Profile] User or Supabase not configured, skipping save');
      toast.success('Profile saved (mock)');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Only update fields that exist in the profiles table schema
      const updateData: any = {
        full_name: formData.name || null,
        bio: formData.bio || null,
        updated_at: new Date().toISOString(),
      };

      console.log('[Profile] Update data prepared', updateData);

      // Only include email if it's different (and if we're allowed to update it)
      // Note: email updates might require special handling

      // Check if profile exists, if not create it first
      console.log('[Profile] Checking if profile exists', { userId: user.id });
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[Profile] Profile existence check', { existingProfile, checkError });

      let updateError;
      if (!existingProfile) {
        // Profile doesn't exist, create it
        console.log('[Profile] Profile not found, creating new profile with data:', {
          id: user.id,
          email: user.email || '',
          ...updateData,
        });
        const { data: createData, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            ...updateData,
          })
          .select();
        
        console.log('[Profile] Profile creation result', { createData, createError });
        updateError = createError;
      } else {
        // Profile exists, update it
        console.log('[Profile] Profile exists, updating with data:', updateData);
        const { data: updateResult, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)
          .select();
        
        console.log('[Profile] Profile update result', { updateResult, error });
        updateError = error;
      }

      if (updateError) {
        console.error('[Profile] Update error details:', {
          code: (updateError as any).code,
          message: (updateError as any).message,
          status: (updateError as any).status,
          details: (updateError as any).details,
          hint: (updateError as any).hint,
          fullError: updateError
        });
        
        // Check for specific error codes
        const errorCode = (updateError as any).code || (updateError as any).status;
        if (errorCode === 400 || errorCode === 406) {
          console.error('[Profile] Bad request error (400/406) - likely data validation issue');
          toast.error('Invalid data. Please check your input.');
        } else {
          console.error('[Profile] Other error:', errorCode);
          toast.error('Failed to update profile: ' + (updateError.message || 'Unknown error'));
        }
        throw updateError;
      }

      console.log('[Profile] Profile saved successfully');
      toast.success('Profile updated successfully');
      
      // Reload profile to ensure UI is in sync
      console.log('[Profile] Reloading profile after successful save');
      await loadProfile();
    } catch (err) {
      console.error('[Profile] Error updating profile:', {
        error: err,
        errorType: typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        fullError: err
      });
      setError('Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
      console.log('[Profile] handleSubmit completed');
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="h-6 w-6" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal information
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Personal Information */}
        <div className="bg-secondary rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-background border border-accent"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 rounded-lg bg-background border border-accent opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-background border border-accent"
                rows={3}
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 