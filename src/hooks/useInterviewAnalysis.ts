import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { InterviewAnalysis } from '@/types/analysis';

export function useInterviewAnalysis(sessionId: string | undefined) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'pending_analysis' | 'analyzing' | 'completed' | 'failed'>('idle');
  const [analysis, setAnalysis] = useState<InterviewAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!sessionId) return;
    
    setStatus('loading');
    
    try {
      const { data, error: statusError } = await supabase
        .from('interview_sessions')
        .select(`
          status,
          interview_analyses (*)
        `)
        .eq('id', sessionId)
        .single();

      if (statusError) throw statusError;
      
      setStatus(data.status as any);
      
      if (data.interview_analyses && data.interview_analyses.length > 0) {
        setAnalysis(data.interview_analyses[0] as InterviewAnalysis);
      }
      
      // If still processing, check again in 5 seconds
      if (['pending_analysis', 'analyzing'].includes(data.status)) {
        const timer = setTimeout(checkStatus, 5000);
        return () => clearTimeout(timer);
      }
      
    } catch (err) {
      console.error('Error checking analysis status:', err);
      setError('Failed to check analysis status');
      setStatus('failed');
    }
  }, [sessionId]);

  const startAnalysis = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setStatus('loading');
      
      const { error: updateError } = await supabase
        .from('interview_sessions')
        .update({ status: 'pending_analysis' })
        .eq('id', sessionId);
        
      if (updateError) throw updateError;
      
      // Start polling for status updates
      checkStatus();
      
    } catch (err) {
      console.error('Error starting analysis:', err);
      setError('Failed to start analysis');
      setStatus('failed');
    }
  }, [sessionId, checkStatus]);

  useEffect(() => {
    if (sessionId) {
      checkStatus();
    }
  }, [sessionId, checkStatus]);

  return {
    status,
    analysis,
    error,
    startAnalysis,
    refresh: checkStatus,
    isLoading: status === 'loading' || status === 'analyzing' || status === 'pending_analysis',
    isComplete: status === 'completed',
    isFailed: status === 'failed',
  };
}
