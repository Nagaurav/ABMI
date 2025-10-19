import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware to verify JWT token and extract user ID
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Attach user ID to request object
    req.userId = user.id;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * GET /api/dashboard/summary
 * Returns comprehensive dashboard data for the authenticated user
 */
router.get('/summary', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    // Fetch user profile (name)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    // Fetch KPIs: total interviews and average score
    const { data: interviews, error: interviewsError } = await supabase
      .from('interviews')
      .select(`
        id,
        session_date,
        duration,
        score,
        status,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (interviewsError) {
      console.error('Interviews fetch error:', interviewsError);
      return res.status(500).json({ error: 'Failed to fetch interviews' });
    }

    // Fetch feedback data for scores and improvement areas
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback')
      .select(`
        id,
        interview_id,
        overall_score,
        key_improvement_area,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('Feedback fetch error:', feedbackError);
    }

    // Calculate KPIs
    const completedInterviews = interviews?.filter(i => i.status === 'completed') || [];
    const interviewsCompleted = completedInterviews.length;
    
    // Calculate average score from feedback
    const feedbackWithScores = feedbackData?.filter(f => f.overall_score !== null) || [];
    const averageScore = feedbackWithScores.length > 0
      ? Math.round(feedbackWithScores.reduce((sum, f) => sum + f.overall_score, 0) / feedbackWithScores.length)
      : 0;

    // Get most recent improvement area
    const keyImprovementArea = feedbackData?.[0]?.key_improvement_area || 'Keep practicing!';

    // Build performance history (last 10 sessions with scores)
    const performanceHistory = [];
    const interviewsWithFeedback = interviews?.slice(0, 10) || [];
    
    for (const interview of interviewsWithFeedback) {
      const feedback = feedbackData?.find(f => f.interview_id === interview.id);
      if (feedback?.overall_score !== null) {
        performanceHistory.push({
          date: interview.session_date || interview.created_at?.split('T')[0],
          score: feedback.overall_score
        });
      }
    }

    // Build interview history (last 5 sessions)
    const interviewHistory = [];
    const recentInterviews = interviews?.slice(0, 5) || [];
    
    for (const interview of recentInterviews) {
      const feedback = feedbackData?.find(f => f.interview_id === interview.id);
      
      // Parse duration from interval format (e.g., "00:15:32" or PostgreSQL interval)
      let durationSeconds = 0;
      if (interview.duration) {
        const durationStr = interview.duration.toString();
        const parts = durationStr.split(':');
        if (parts.length === 3) {
          durationSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        }
      }

      interviewHistory.push({
        interview_session_id: interview.id,
        date: interview.session_date || interview.created_at?.split('T')[0],
        duration: durationSeconds,
        score: feedback?.overall_score || interview.score || 0,
        status: interview.status
      });
    }

    // Construct response
    const dashboardData = {
      name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
      email: profile?.email,
      averageScore,
      interviewsCompleted,
      keyImprovementArea,
      performanceHistory: performanceHistory.reverse(), // Oldest to newest for chart
      interviewHistory
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/dashboard/stats
 * Returns quick stats for the authenticated user
 */
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    // Get total interviews count
    const { count: totalInterviews, error: countError } = await supabase
      .from('interviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Count error:', countError);
    }

    // Get completed interviews count
    const { count: completedCount, error: completedError } = await supabase
      .from('interviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (completedError) {
      console.error('Completed count error:', completedError);
    }

    // Get average score
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback')
      .select('overall_score')
      .eq('user_id', userId)
      .not('overall_score', 'is', null);

    if (feedbackError) {
      console.error('Feedback error:', feedbackError);
    }

    const averageScore = feedbackData && feedbackData.length > 0
      ? Math.round(feedbackData.reduce((sum, f) => sum + f.overall_score, 0) / feedbackData.length)
      : 0;

    res.json({
      totalInterviews: totalInterviews || 0,
      completedInterviews: completedCount || 0,
      averageScore
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
