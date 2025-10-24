import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper functions
function calculateSpeakingTime(logs: any[]): number {
  const speakingLogs = logs?.filter((log: any) => log.type === 'speaking') || [];
  return speakingLogs.reduce((total: number, log: any) => {
    return total + (log.metadata?.duration || 0);
  }, 0);
}

function calculateAverageMetric(logs: any[], metricType: string, defaultValue: number = 0): number {
  const metricLogs = logs?.filter((log: any) => log.type === metricType) || [];
  if (metricLogs.length === 0) return defaultValue;
  
  const sum = metricLogs.reduce((total: number, log: any) => {
    return total + (log.metadata?.value || 0);
  }, 0);
  
  return sum / metricLogs.length;
}

function countFeedbackByType(logs: any[], type: string): number {
  return logs?.filter((log: any) => log.type === type).length ?? 0;
}

router.post('/start', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Your existing analysis logic here...
    // (I'll add the rest of your analysis code here)
    
    res.json({ message: 'Analysis started', status: 'analyzing' });
  } catch (error) {
    console.error('Error in analysis handler:', error);
    res.status(500).json({ 
      error: 'Failed to start analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
      status: 'failed'
    });
  }
});

export default router;
