import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { useInterviewAnalysis } from '@/hooks/useInterviewAnalysis';

export function AnalysisReport({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { 
    status, 
    analysis, 
    error, 
    startAnalysis, 
    isLoading, 
    isComplete, 
    isFailed 
  } = useInterviewAnalysis(sessionId);

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Session ID is required</h2>
        <p className="text-gray-600 mb-6">Please provide a valid session ID to view the analysis.</p>
        <Button onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          {status === 'analyzing' ? 'Analyzing your interview...' : 'Loading analysis...'}
        </h2>
        <p className="text-gray-600">This may take a few moments.</p>
      </div>
    );
  }

  if (error || isFailed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">
          {error || 'Failed to load analysis'}
        </h2>
        <p className="text-gray-600 mb-6">
          We couldn't load the analysis for this interview. Please try again later.
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'completed' && analysis) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Interview
        </Button>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Interview Analysis</h1>
          <div className="inline-flex items-center justify-center px-4 py-2 bg-primary/10 rounded-full">
            <div className="text-2xl font-bold text-primary">
              Overall Score: {analysis.overall_score}/100
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {analysis.areas_for_improvement.map((area, index) => (
                  <li key={index} className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-gray-700">{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Detailed Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              {analysis.analysis.split('\n').map((paragraph, i) => (
                <p key={i} className="text-gray-700 mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => window.print()}>
            Print Report
          </Button>
          <Button>Share Results</Button>
        </div>
      </div>
    );
  }

  // Default state - no analysis available
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">No Analysis Available</h2>
      <p className="text-gray-600 mb-6">
        The analysis for this interview is not available yet.
      </p>
      <Button onClick={startAnalysis} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Starting Analysis...
          </>
        ) : (
          'Start Analysis'
        )}
      </Button>
    </div>
  );
}
