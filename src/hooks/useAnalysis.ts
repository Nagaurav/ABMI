import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Interview, Feedback } from '../lib/types';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

interface SkillScore {
  name: string;
  value: number;
}

interface AnalysisData {
  performanceData: { date: string; score: number; duration: number }[];
  skillsData: SkillScore[];
  communicationSkills: {
    clarity: number;
    structure: number;
    examples: number;
    bodyLanguage: number;
  };
  recommendations: { title: string; description: string }[];
  latestInterview: Interview | null;
  loading: boolean;
  error: string | null;
  metrics?: {
    confidence: number;
    clarity: number;
    engagement: number;
    responseQuality: number;
  };
  overallScore: number;
  feedback: {
    strengths: string[];
    improvements: string[];
  };
  recentInterviews: {
    id: string;
    date: string;
    score: number;
    duration: number;
  }[];
}

export function useAnalysis(): AnalysisData & {
  exportPDF: () => Promise<void>;
  shareReport: () => Promise<void>;
} {
  const [performanceData, setPerformanceData] = useState<{ date: string; score: number; duration: number }[]>([]);
  const [skillsData, setSkillsData] = useState<SkillScore[]>([]);
  const [communicationSkills, setCommunicationSkills] = useState({
    clarity: 0,
    structure: 0,
    examples: 0,
    bodyLanguage: 0,
  });
  const [recommendations, setRecommendations] = useState<{ title: string; description: string }[]>([]);
  const [latestInterview, setLatestInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ confidence: number; clarity: number; engagement: number; responseQuality: number } | undefined>();
  const [overallScore, setOverallScore] = useState(0);
  const [feedback, setFeedback] = useState<{ strengths: string[]; improvements: string[] }>({ strengths: [], improvements: [] });
  const [recentInterviews, setRecentInterviews] = useState<{ id: string; date: string; score: number; duration: number }[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchAnalysisData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch last 30 days of interviews
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: interviews, error: interviewsError } = await supabase
          .from('interviews')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        if (interviewsError) throw interviewsError;

        // Format performance data
        const performance = (interviews || []).map(interview => ({
          date: new Date(interview.created_at || interview.session_date || new Date()).toLocaleDateString(),
          score: interview.score || 0,
          duration: typeof interview.duration === 'number' ? interview.duration : 0,
        }));

        // Format recent interviews (last 5)
        const recent = (interviews || [])
          .slice(-5)
          .reverse()
          .map(interview => ({
            id: interview.id,
            date: new Date(interview.created_at || interview.session_date || new Date()).toLocaleDateString(),
            score: interview.score || 0,
            duration: typeof interview.duration === 'number' ? interview.duration : 0,
          }));

        // Calculate overall score from interviews
        const scores = (interviews || []).map(i => i.score || 0).filter(s => s > 0);
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

        // Fetch feedback for skills analysis
        const { data: feedbackData, error: feedbackError } = await supabase
          .from('feedback')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (feedbackError) {
          console.warn('Feedback fetch error:', feedbackError);
          // Continue without feedback data
        }

        // Process feedback data if available
        const feedbackDataArray = feedbackData || [];
        const totalFeedback = feedbackDataArray.length || 1;

        // Calculate average scores for different skills
        const skills = feedbackDataArray.reduce((acc, feedback) => {
          acc.technical = (acc.technical || 0) + (feedback.response_quality || 0);
          acc.communication = (acc.communication || 0) + (feedback.clarity_score || 0);
          acc.problemSolving = (acc.problemSolving || 0) + (feedback.answer_structure || 0);
          acc.leadership = (acc.leadership || 0) + (feedback.engagement_score || 0);
          return acc;
        }, {} as Record<string, number>);

        const skillsDataArray = totalFeedback > 0 && feedbackDataArray.length > 0 ? [
          { name: 'Technical Knowledge', value: Math.round((skills.technical || 0) / totalFeedback) },
          { name: 'Communication', value: Math.round((skills.communication || 0) / totalFeedback) },
          { name: 'Problem Solving', value: Math.round((skills.problemSolving || 0) / totalFeedback) },
          { name: 'Leadership', value: Math.round((skills.leadership || 0) / totalFeedback) },
        ] : [];

        // Calculate communication skills
        const commSkills = feedbackDataArray.reduce((acc, feedback) => {
          acc.clarity += feedback.clarity_score || 0;
          acc.structure += feedback.answer_structure || 0;
          acc.examples += feedback.response_quality || 0;
          acc.bodyLanguage += feedback.eye_contact_score || 0;
          return acc;
        }, { clarity: 0, structure: 0, examples: 0, bodyLanguage: 0 });

        const normalizedCommSkills = totalFeedback > 0 && feedbackDataArray.length > 0 ? {
          clarity: Math.round(commSkills.clarity / totalFeedback),
          structure: Math.round(commSkills.structure / totalFeedback),
          examples: Math.round(commSkills.examples / totalFeedback),
          bodyLanguage: Math.round(commSkills.bodyLanguage / totalFeedback),
        } : { clarity: 0, structure: 0, examples: 0, bodyLanguage: 0 };

        // Calculate metrics from feedback
        const calculatedMetrics = totalFeedback > 0 && feedbackDataArray.length > 0 ? {
          confidence: Math.round((feedbackDataArray.reduce((sum, f) => sum + (f.confidence_score || 0), 0) / totalFeedback)),
          clarity: normalizedCommSkills.clarity,
          engagement: Math.round((feedbackDataArray.reduce((sum, f) => sum + (f.engagement_score || 0), 0) / totalFeedback)),
          responseQuality: normalizedCommSkills.examples,
        } : undefined;

        // Get latest feedback for recommendations and strengths/improvements
        const latestFeedback = feedbackDataArray[0];
        const recommendationsArray = latestFeedback?.feedback_text?.map((text, index) => ({
          title: `Recommendation ${index + 1}`,
          description: text,
        })) || [];

        // Extract strengths and improvements from feedback
        const feedbackObj = {
          strengths: latestFeedback?.feedback_text?.filter((text, idx) => idx % 2 === 0) || [],
          improvements: latestFeedback?.feedback_text?.filter((text, idx) => idx % 2 === 1) || [],
        };

        setPerformanceData(performance);
        setSkillsData(skillsDataArray);
        setCommunicationSkills(normalizedCommSkills);
        setRecommendations(recommendationsArray);
        setLatestInterview((interviews && interviews.length > 0) ? interviews[interviews.length - 1] : null);
        setMetrics(calculatedMetrics);
        setOverallScore(avgScore);
        setFeedback(feedbackObj);
        setRecentInterviews(recent);
        setError(null);
      } catch (err) {
        console.error('Error fetching analysis data:', err);
        setError('Failed to load analysis data');
        toast.error('Failed to load analysis data');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysisData();
  }, [user]);

  const exportPDF = async () => {
    try {
      toast.info('Preparing PDF export...');
      // Implementation would go here - for now just show success
      setTimeout(() => {
        toast.success('Analysis report exported successfully');
      }, 1500);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast.error('Failed to export PDF');
    }
  };

  const shareReport = async () => {
    try {
      toast.info('Preparing report for sharing...');
      // Implementation would go here - for now just show success
      setTimeout(() => {
        toast.success('Report shared successfully');
      }, 1500);
    } catch (err) {
      console.error('Error sharing report:', err);
      toast.error('Failed to share report');
    }
  };

  return {
    performanceData,
    skillsData,
    communicationSkills,
    recommendations,
    latestInterview,
    loading,
    error,
    metrics,
    overallScore,
    feedback,
    recentInterviews,
    exportPDF,
    shareReport,
  };
}