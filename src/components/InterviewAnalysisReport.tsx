import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2, CheckCircle, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';

interface AnalysisResult {
  id: string;
  session_id: string;
  analysis: string;
  strengths: string[];
  areas_for_improvement: string[];
  overall_score: number;
  created_at: string;
  metrics?: {
    speaking_time?: number;
    avg_volume?: number;
    avg_pace?: number;
    eye_contact_score?: number;
    posture_score?: number;
    filler_word_count?: number;
  };
}

export default function InterviewAnalysisReport() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  const fetchAnalysis = async (): Promise<boolean> => {
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
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError('Failed to load analysis. Please try again.');
      setIsLoading(false);
      return false;
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    let intervalId: NodeJS.Timeout;
    
    const startPolling = async () => {
      const found = await fetchAnalysis();
      if (found) return;

      intervalId = setInterval(async () => {
        const found = await fetchAnalysis();
        setPollingCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 24) {
            clearInterval(intervalId);
            setError('Analysis is taking longer than expected. Please refresh the page to check again.');
            setIsLoading(false);
          }
          return newCount;
        });
      }, 5000);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Analysis</h1>
          <p className="text-muted-foreground">
            Analysis completed on {formatDate(analysis.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center bg-primary/10 px-6 py-3 rounded-lg">
            <div className="text-4xl font-bold text-primary">
              {analysis.overall_score}
              <span className="text-muted-foreground text-lg">/100</span>
            </div>
            <div className="text-sm text-muted-foreground">Overall Score</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="bg-green-50 dark:bg-green-900/20 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Strengths
            </CardTitle>
            <CardDescription>Areas where you excelled</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {analysis.strengths?.length > 0 ? (
              <ul className="space-y-3">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-2.5 flex-shrink-0" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No strengths recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-amber-50 dark:bg-amber-900/20 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Areas for Improvement
            </CardTitle>
            <CardDescription>Opportunities to enhance your performance</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {analysis.areas_for_improvement?.length > 0 ? (
              <ul className="space-y-3">
                {analysis.areas_for_improvement.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-2.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No improvement areas recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Analysis</CardTitle>
          <CardDescription>Comprehensive feedback on your interview performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            {analysis.analysis.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {analysis.metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Detailed metrics from your interview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {analysis.metrics.speaking_time !== undefined && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Speaking Time</h3>
                  <p className="text-2xl font-bold">
                    {Math.floor(analysis.metrics.speaking_time / 60)}m {analysis.metrics.speaking_time % 60}s
                  </p>
                </div>
              )}
              {analysis.metrics.avg_volume !== undefined && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Average Volume</h3>
                  <p className="text-2xl font-bold">
                    {Math.round(analysis.metrics.avg_volume * 100)}%
                  </p>
                </div>
              )}
              {analysis.metrics.avg_pace !== undefined && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Speaking Pace</h3>
                  <p className="text-2xl font-bold">
                    {Math.round(analysis.metrics.avg_pace)} WPM
                  </p>
                </div>
              )}
              {analysis.metrics.eye_contact_score !== undefined && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Eye Contact</h3>
                  <p className="text-2xl font-bold">
                    {Math.round(analysis.metrics.eye_contact_score * 100)}%
                  </p>
                </div>
              )}
              {analysis.metrics.posture_score !== undefined && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Posture Score</h3>
                  <p className="text-2xl font-bold">
                    {Math.round(analysis.metrics.posture_score * 100)}%
                  </p>
                </div>
              )}
              {analysis.metrics.filler_word_count !== undefined && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Filler Words</h3>
                  <p className="text-2xl font-bold">
                    {analysis.metrics.filler_word_count}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-4 pt-4">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
        <Button onClick={() => window.print()}>
          Print Report
        </Button>
      </div>
    </div>
  );
}
