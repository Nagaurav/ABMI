import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AnalysisReport } from '@/components/AnalysisReport';
import { useInterviewAnalysis } from '@/hooks/useInterviewAnalysis';
import { Loader2 } from 'lucide-react';

export default function AnalysisPage() {
  const router = useRouter();
  const { id } = router.query;
  const { status, analysis, error, refresh } = useInterviewAnalysis(id as string);

  // Refresh data every 5 seconds if still loading
  useEffect(() => {
    if (status === 'pending_analysis' || status === 'analyzing') {
      const interval = setInterval(refresh, 5000);
      return () => clearInterval(interval);
    }
  }, [status, refresh]);

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Interview Selected</h1>
          <p className="text-gray-600">Please select an interview to view its analysis.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Analysis</h1>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading' || status === 'pending_analysis' || status === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {status === 'analyzing' ? 'Analyzing Interview...' : 'Loading Analysis...'}
        </h1>
        <p className="text-gray-600">This may take a few moments.</p>
      </div>
    );
  }

  return <AnalysisReport sessionId={id as string} />;
}
