import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const supabase = createServerSupabaseClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      return res.status(200).json({
        name: profile.full_name,
        email: profile.email,
        preferences: preferences || {
          app_language: 'en',
          ai_voice_gender: 'female',
          feedback_sensitivity: 3
        }
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { app_language, ai_voice_gender, feedback_sensitivity } = req.body;

      // Validate input
      if (!['en', 'es'].includes(app_language)) {
        return res.status(400).json({ error: 'Invalid language' });
      }
      if (!['male', 'female'].includes(ai_voice_gender)) {
        return res.status(400).json({ error: 'Invalid voice gender' });
      }
      if (typeof feedback_sensitivity !== 'number' || feedback_sensitivity < 1 || feedback_sensitivity > 5) {
        return res.status(400).json({ error: 'Invalid sensitivity value' });
      }

      // Update preferences
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: session.user.id,
          app_language,
          ai_voice_gender,
          feedback_sensitivity,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      return res.status(200).json({ message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};

export default handler;
