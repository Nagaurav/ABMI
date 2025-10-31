import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No profile found, create one
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert([
                {
                  user_id: user.id,
                  full_name: user.email?.split('@')[0] || '',
                  avatar_url: '',
                  bio: '',
                  company: '',
                  position: '',
                  location: '',
                  website: '',
                  linkedin: '',
                  github: '',
                },
              ])
              .select()
              .single();

            if (createError) throw createError;
            setProfile(newProfile);
          } else {
            throw fetchError;
          }
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  // ... rest of the code ...
} 