import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2, CheckCircle, AlertCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

interface AnalysisResult {
  analysis: string;
  strengths: string[];
  areas_for_improvement: string[];
  overall_score: number;
  created_at: string;
}

export default function AnalysisReport() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const { toast } = useToast();

  const fetchAnalysis = async () => {
    if (!sessionId) return false;

    try {
      const { data, error } = await supabase
        .from('interview_analyses')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;

      if (data) {
        setAnalysis(data);
        setIsLoading(false);
        return true; // Analysis found
      }
      return false; // Analysis not found yet
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError('Failed to load analysis. Please try again.');
      setIsLoading(false);
      return false;
    }
  };

  // Start polling for analysis results
  useEffect(() => {
    if (!sessionId) return;

    let intervalId: NodeJS.Timeout;
    
    const startPolling = async () => {
      // Initial check
      const found = await fetchAnalysis();
      if (found) return;

      // If not found, start polling
      intervalId = setInterval(async () => {
        const found = await fetchAnalysis();
        setPollingCount(prev => {
          const newCount = prev + 1;
          // Stop polling after 2 minutes (24 * 5s = 120s)
          if (newCount >= 24) {
            clearInterval(intervalId);
            setError('Analysis is taking longer than expected. Please refresh the page to check again.');
            setIsLoading(false);
          }
          return newCount;
        });
      }, 5000); // Poll every 5 seconds
    };

    startPolling();
    return () => clearInterval(intervalId);
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4 max-w-2xl">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Generating Your Analysis</h1>
          <p className="text-muted-foreground">
            We're analyzing your interview. This may take a few moments...
          </p>
          <Progress value={(pollingCount / 24) * 100} className="w-full max-w-md mx-auto" />
          <p className="text-sm text-muted-foreground">
            {pollingCount * 5} seconds elapsed
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4 max-w-2xl">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Analysis Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4 max-w-2xl">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Analysis Not Found</h1>
          <p className="text-muted-foreground">
            We couldn't find the analysis for this session. Please check the URL or try again later.
          </p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Interview Analysis</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Overall Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-indigo-600">85%</div>
            <div className="text-sm text-gray-500">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600">92%</div>
            <div className="text-sm text-gray-500">Best Category</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-600">78%</div>
            <div className="text-sm text-gray-500">Needs Improvement</div>
          </div>
        </div>
      </div>

      {/* Performance Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Performance Timeline</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockTimelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="posture" stroke="#4F46E5" />
              <Line type="monotone" dataKey="emotion" stroke="#10B981" />
              <Line type="monotone" dataKey="tone" stroke="#F59E0B" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Skills Radar */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Skills Analysis</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={mockRadarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar
                name="Performance"
                dataKey="A"
                stroke="#4F46E5"
                fill="#818CF8"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Improvement Suggestions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">AI-Powered Suggestions</h2>
        <div className="space-y-4">
          {mockSuggestions.map((suggestion, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-600" />
              <p className="text-gray-600">{suggestion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 