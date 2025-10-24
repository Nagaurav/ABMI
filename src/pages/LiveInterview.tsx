import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Video, VideoOff, Mic, MicOff, Volume2, Eye, Smile, Frown, Clock } from 'lucide-react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import useMediaPipe, { MediaPipeResults } from '@/hooks/useMediaPipe';
import useAudioAnalysis, { AudioAnalysis } from '@/hooks/useAudioAnalysis';

declare global {
  interface Window {
    MediaRecorder: any;
  }
}

// Type definitions
interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  timeLimit: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

type InterviewStatus = 'idle' | 'starting' | 'active' | 'completed' | 'error';
type FeedbackType = 'eye_contact' | 'posture' | 'volume' | 'pace' | 'filler_words';

interface FeedbackItem {
  type: FeedbackType;
  message: string;
  isPositive: boolean;
  timestamp: Date;
}

type InterviewStatus = 'idle' | 'starting' | 'active' | 'completed' | 'error';

type FeedbackType = 'eye_contact' | 'posture' | 'volume' | 'pace' | 'filler_words';

interface FeedbackItem {
  type: FeedbackType;
  message: string;
  isPositive: boolean;
  timestamp: Date;
}

interface InterviewQuestion {
  id: string;
  question: string;
  text?: string; // Keeping for backward compatibility
  category: string;
  timeLimit: number; // in seconds
  difficulty: 'easy' | 'medium' | 'hard';
}

const LiveInterview: React.FC = () => {
  // Hooks
  const user = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // State
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // MediaPipe hooks
  const mediaPipe = useMediaPipe();
  const { isModelLoading, faceLandmarks, poseLandmarks, startDetection, stopDetection } = mediaPipe || {};
  
  // Audio analysis
  const audioAnalysis = useAudioAnalysis();
  const { startAnalysis, stopAnalysis, volume = 0.5, speakingRate = 3 } = audioAnalysis || {};
    poseLandmarks,
    analysisResults
  } = useMediaPipe({
    enableFaceMesh: true,
    enablePose: true,
    enableHands: false
  });

  const {
    isAnalyzing: isAudioAnalyzing,
    startAnalysis,
    stopAnalysis,
    volume,
    speakingRate,
    fillerWords
  } = useAudioAnalysis();

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/interview-stream`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      if (sessionId) {
        ws.send(JSON.stringify({
          type: 'session_init',
          session_id: sessionId,
          user_id: user?.id
        }));
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'question') {
          setCurrentQuestion(data.question);
        } else if (data.type === 'feedback') {
          addFeedback({
            type: data.feedback_type,
            message: data.message,
            isPositive: data.is_positive,
            timestamp: new Date()
          });
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      if (status === 'active') {
        // Try to reconnect if we're still in an active interview
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, status, user?.id]);

  // Initialize media devices and WebSocket
  useEffect(() => {
    const initializeInterview = async () => {
      if (status !== 'idle') return;
      
      setStatus('starting');
      setError(null);
      
      try {
        // Request camera and microphone permissions
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        mediaStreamRef.current = stream;
        
        // Initialize WebSocket connection
        connectWebSocket();
        
        // Load interview questions
        await loadQuestions();
        
        setStatus('active');
      } catch (err) {
        console.error('Error initializing interview:', err);
        setError('Failed to access camera/microphone. Please check your permissions.');
        setStatus('error');
      }
    };
    
    initializeInterview();
    
    return () => {
      // Cleanup
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket, status]);

  // Handle media analysis results
  useEffect(() => {
    if (status !== 'active' || !analysisResults) return;
    
    // Process face and pose analysis results
    if (analysisResults.face) {
      const { isLookingAtCamera, emotion } = analysisResults.face;
      
      if (!isLookingAtCamera) {
        addFeedback({
          type: 'eye_contact',
          message: 'Try to maintain eye contact with the camera',
          isPositive: false,
          timestamp: new Date()
        });
      }
      
      // Add more feedback based on emotion, head position, etc.
    }
    
    if (analysisResults.pose) {
      const { posture } = analysisResults.pose;
      
      if (posture === 'slouching') {
        addFeedback({
          type: 'posture',
          message: 'Sit up straight for better posture',
          isPositive: false,
          timestamp: new Date()
        });
      }
    }
    
    // Send analysis data to WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'analysis_data',
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        data: analysisResults
      }));
    }
  }, [analysisResults, sessionId, status]);

  // Handle audio analysis results
  useEffect(() => {
    if (status !== 'active' || !volume) return;
    
    // Check for speaking volume
    if (volume < 0.1) {
      addFeedback({
        type: 'volume',
        message: 'Speak up a bit',
        isPositive: false,
        timestamp: new Date()
      });
    } else if (volume > 0.9) {
      addFeedback({
        type: 'volume',
        message: 'You\'re speaking too loudly',
        isPositive: false,
        timestamp: new Date()
      });
    }
    
    // Check for speaking rate
    if (speakingRate > 5) {
      addFeedback({
        type: 'pace',
        message: 'Try to speak a bit slower',
        isPositive: false,
        timestamp: new Date()
      });
    } else if (speakingRate < 2) {
      addFeedback({
        type: 'pace',
        message: 'Try to speak a bit faster',
        isPositive: false,
        timestamp: new Date()
      });
    }
    
    // Check for filler words
    if (fillerWords.length > 3) {
      addFeedback({
        type: 'filler_words',
        message: `Try to reduce filler words (${fillerWords.join(', ')})`,
        isPositive: false,
        timestamp: new Date()
      });
    }
  }, [volume, speakingRate, fillerWords, status]);

  // Auto-scroll feedback to bottom when new feedback is added
  useEffect(() => {
    feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feedback]);

  // Timer effect
  useEffect(() => {
    if (status !== 'active') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Load interview questions
  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('interview_questions')
        .select('*')
        .order('difficulty', { ascending: true });
      
      if (error) throw error;
      
      setQuestions(data || []);
      
      // Set first question
      if (data?.length > 0) {
        setCurrentQuestion(data[0]);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
      setError('Failed to load interview questions');
      setStatus('error');
    }
  };

  // Start the interview
  const startInterview = async () => {
    if (status !== 'starting') return;
    
    try {
      // Create a new interview session
      const { data: session, error } = await supabase
        .from('interview_sessions')
        .insert([{
          user_id: user?.id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      setSessionId(session.id);
      
      // Start media recording
      if (mediaStreamRef.current) {
        const mimeType = 'video/webm;codecs=vp9,opus';
        const options = { mimeType };
        
        try {
          const recorder = new MediaRecorder(mediaStreamRef.current, options);
          mediaRecorderRef.current = recorder;
          
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          
          recorder.onstop = async () => {
            // Upload recording when interview ends
            await uploadRecording();
          };
          
          recorder.start(1000); // Collect data every second
        } catch (err) {
          console.error('Error creating MediaRecorder:', err);
          // Fallback to default MIME type
          const fallbackRecorder = new MediaRecorder(mediaStreamRef.current);
          mediaRecorderRef.current = fallbackRecorder;
          fallbackRecorder.start(1000);
        }
      }
      
      // Start analysis
      startDetection(webcamRef.current?.video as HTMLVideoElement);
      startAnalysis();
      
      setStatus('active');
      toast({
        title: 'Interview started',
        description: 'Your interview has begun. Good luck!',
      });
      
    } catch (err) {
      console.error('Error starting interview:', err);
      setError('Failed to start interview. Please try again.');
      setStatus('error');
    }
  };

  // End the interview
  const endInterview = async () => {
    if (status !== 'active') return;
    
    setStatus('completed');
    
    // Stop media recording and analysis
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    stopDetection();
    stopAnalysis();
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Update session status
    if (sessionId) {
      await supabase
        .from('interview_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: timeElapsed
        })
        .eq('id', sessionId);
    }
    
    toast({
      title: 'Interview completed',
      description: 'Your interview has been submitted for analysis.',
    });
    
    // Redirect to analysis page after a delay
    setTimeout(() => {
      navigate('/analysis');
    }, 3000);
  };

  // Upload recording to storage
  const uploadRecording = async () => {
    if (!sessionId || audioChunksRef.current.length === 0) return;
    
    try {
      const blob = new Blob(audioChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `interview-${sessionId}.webm`, { type: 'video/webm' });
      
      const filePath = `recordings/${user?.id}/${sessionId}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('interview-recordings')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('interview-recordings')
        .getPublicUrl(filePath);
      
      // Update session with recording URL
      await supabase
        .from('interview_sessions')
        .update({ recording_url: publicUrl })
        .eq('id', sessionId);
      
      console.log('Recording uploaded successfully:', publicUrl);
    } catch (err) {
      console.error('Error uploading recording:', err);
    }
  };

  // Add feedback to the list
  const addFeedback = (item: Omit<FeedbackItem, 'id'>) => {
    setFeedback(prev => {
      // Don't add duplicate feedback
      const isDuplicate = prev.some(f => 
        f.type === item.type && 
        f.message === item.message &&
        (new Date().getTime() - f.timestamp.getTime()) < 10000 // Within 10 seconds
      );
      
      if (isDuplicate) return prev;
      
      // Keep only the last 10 feedback items
      return [...prev.slice(-9), { ...item, id: Date.now().toString() }];
    });
  };

  // Toggle camera on/off
  const toggleCamera = () => {
    if (!mediaStreamRef.current) return;
    
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  // Toggle microphone on/off
  const toggleMicrophone = () => {
    if (!mediaStreamRef.current) return;
    
    const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get feedback icon based on type
  const getFeedbackIcon = (type: FeedbackType) => {
    switch (type) {
      case 'eye_contact':
        return <Eye className="w-4 h-4 mr-2" />;
      case 'posture':
        return <Smile className="w-4 h-4 mr-2" />;
      case 'volume':
        return <Volume2 className="w-4 h-4 mr-2" />;
      case 'pace':
        return <Clock className="w-4 h-4 mr-2" />;
      case 'filler_words':
        return <Frown className="w-4 h-4 mr-2" />;
      default:
        return null;
    }
  };

  // Loading state
  if (status === 'starting' || status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Preparing your interview</h1>
          <p className="text-gray-600 mb-6">
            We're setting up your interview environment. Please wait...
          </p>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Frown className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            {error || 'We encountered an error while setting up your interview.'}
          </p>
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Try Again
            </Button>
            <Button 
              onClick={() => navigate('/dashboard')} 
              variant="outline"
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
// Clean up function for the component
  useEffect(() => {
    return () => {
      // Clean up media streams and WebSocket on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      stopDetection();
      stopAnalysis();
    };
  }, [stopDetection, stopAnalysis]);
    stopAudioAnalysis,
    getAudioAnalysis
  } = useAudioAnalysis();

  // Initialize interview session
  const initializeInterview = useCallback(async () => {
    if (!user) {
      setInitializationError('User not authenticated. Please log in.');
      setIsLoading(false);
      setIsInitializing(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Create a new interview session
      const { data: session, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert([{
          user_id: user.id,
          status: 'preparing',
          started_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;
      setInterviewSession(session);

      // Fetch interview questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('interview_questions')
        .select('*')
        .order('difficulty', { ascending: true })
        .limit(5);

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);
      
      if (questionsData && questionsData.length > 0) {
        setCurrentQuestion(questionsData[0]);
      }
      
      // Initialize media devices
      try {
        await startMediaDevices();
        await startDetection();
        await startAudioAnalysis();
        
        setIsLoading(false);
        setIsInitializing(false);
      } catch (mediaError) {
        console.error('Error initializing media devices:', mediaError);
        setInitializationError('Failed to access camera or microphone. Please check your permissions.');
        setIsLoading(false);
        setIsInitializing(false);
      }
    } catch (error) {
      console.error('Error initializing interview:', error);
      setInitializationError('Failed to initialize interview session. Please try again.');
      setIsLoading(false);
      setIsInitializing(false);
      
      toast({
        title: 'Error',
        description: 'Failed to initialize interview session.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Start interview
  const startInterview = async () => {
    if (!interviewSession) return;
    
    try {
      // Start media devices
      await startMediaDevices();
      
      // Update session status to 'in_progress'
      const { error } = await supabase
        .from('interview_sessions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', interviewSession.id);

      if (error) throw error;
      
      setInterviewSession(prev => prev ? { ...prev, status: 'in_progress' } : null);
      setIsInterviewActive(true);
      
      // Start timers and analysis
      startTimers();
      startAnalysis();
      
      toast({
        title: 'Interview Started',
        description: 'Your interview has begun. Good luck!',
      });
    } catch (error) {
      console.error('Error starting interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to start interview. Please check your camera and microphone permissions.',
        variant: 'destructive',
      });
    }
  };

  // Start media devices (camera and microphone)
  const startMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        await webcamRef.current.play().catch(console.error);
      }

      // Set up media recorder for audio
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };

  // Start timers
  const startTimers = () => {
    // Update time elapsed every second
    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
  };

  // Start analysis (face, pose, audio)
  const startAnalysis = async () => {
    if (!webcamRef.current) return;
    
    // Start face and pose detection
    await startDetection();
    
    // Start audio analysis
    startAudioAnalysis();
  };

  // Handle next question
  const handleNextQuestion = () => {
    if (!currentQuestion || !questions.length) return;
    
    const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);
    const nextIndex = (currentIndex + 1) % questions.length;
    setCurrentQuestion(questions[nextIndex]);
  };

  // Handle end interview
  const handleEndInterview = async () => {
    if (!interviewSession) return;
    
    try {
      // Stop all analysis and timers
      stopDetection();
      stopAudioAnalysis();
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Stop media devices
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      
      if (webcamRef.current?.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        webcamRef.current.srcObject = null;
      }
      
      // Close WebSocket connection if exists
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // First update status to 'pending_analysis' to trigger the analysis
      const { error: updateError } = await supabase
        .from('interview_sessions')
        .update({ 
          status: 'pending_analysis',
          ended_at: new Date().toISOString(),
          duration_seconds: timeElapsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', interviewSession.id);

      if (updateError) throw updateError;
      
      // Call the analysis endpoint to start processing
      const response = await fetch('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: interviewSession.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }
      
      // Show completion message
      toast({
        title: 'Interview Completed',
        description: 'Your interview is being analyzed. You can view the results shortly.',
      });
      
      // Navigate to the analysis page
      navigate(`/analysis/${interviewSession.id}`);
      
    } catch (error) {
      console.error('Error ending interview:', error);
      
      // Try to update status to 'analysis_failed' if something went wrong
      try {
        await supabase
          .from('interview_sessions')
          .update({ 
            status: 'analysis_failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', interviewSession.id);
      } catch (e) {
        console.error('Failed to update session status to failed:', e);
      }
      
      toast({
        title: 'Error',
        description: 'Failed to process interview. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeInterview();
      } catch (error) {
        console.error('Initialization error:', error);
        setInitializationError('An unexpected error occurred during initialization.');
        setIsLoading(false);
        setIsInitializing(false);
      }
    };
    
    init();
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Live Interview</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500">
              {formatTime(timeElapsed)}
            </span>
            <Button
              onClick={endInterview}
              variant="destructive"
              className="px-4 py-2 text-sm font-medium"
            >
              End Interview
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video Feed */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            <div className="relative aspect-video bg-black">
              {isVideoOn ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  videoConstraints={{
                    width: 1280,
                    height: 720,
                    facingMode: 'user',
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <VideoOff className="h-12 w-12 text-gray-400" />
                </div>
              )}

              {/* Video Controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                <Button
                  onClick={toggleCamera}
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-10 h-10"
                >
                  {isVideoOn ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
                <Button
                  onClick={toggleMicrophone}
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-10 h-10"
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
              </div>

              {/* Timer */}
              <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                {formatTime(timeElapsed)}
              </div>
            </div>

            {/* Current Question */}
            <div className="p-6 border-t">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Current Question</h2>
              {currentQuestion ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-800">{currentQuestion.text}</p>
                  <div className="mt-2 flex items-center text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {currentQuestion.category}
                    </span>
                    <span className="ml-2">
                      Time limit: {currentQuestion.timeLimit} seconds
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic">No question available</p>
              )}

              {/* Next Question Button */}
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Get next question
                    if (questions.length > 0) {
                      const currentIndex = questions.findIndex(q => q.id === currentQuestion?.id);
                      const nextIndex = (currentIndex + 1) % questions.length;
                      setCurrentQuestion(questions[nextIndex]);
                    }
                  }}
                >
                  Next Question
                </Button>
              </div>
            </div>
          </div>

          {/* Feedback Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Real-time Feedback</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedback(!showFeedback)}
                  >
                    {showFeedback ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <AnimatePresence>
                  {showFeedback && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {feedback.length > 0 ? (
                          feedback.map((item) => (
                            <motion.div
                              key={`${item.timestamp.getTime()}-${item.type}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-3 rounded-lg ${
                                item.isPositive ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'
                              }`}
                            >
                              <div className="flex items-start">
                                <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                                  item.isPositive ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                  {item.isPositive ? (
                                    <span className="text-xs font-bold">✓</span>
                                  ) : (
                                    <span className="text-xs font-bold">!</span>
                                  )}
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">
                                    {item.message}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {format(item.timestamp, 'h:mm a')}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500">No feedback yet. Start speaking to receive feedback.</p>
                          </div>
                        )}
                        <div ref={feedbackEndRef} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Analysis Indicators */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Eye Contact</p>
                      <p className="text-sm font-medium">
                        {analysisResults?.face?.isLookingAtCamera ? 'Good' : 'Look at camera'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Volume2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Volume</p>
                      <p className="text-sm font-medium">
                        {volume < 0.2 ? 'Too low' : volume > 0.8 ? 'Too high' : 'Good'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Pace</p>
                      <p className="text-sm font-medium">
                        {speakingRate < 2 ? 'Too slow' : speakingRate > 5 ? 'Too fast' : 'Good'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Smile className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Posture</p>
                      <p className="text-sm font-medium">
                        {analysisResults?.pose?.posture === 'slouching' ? 'Sit up straight' : 'Good'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* End Interview Card */}
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium text-red-800 mb-2">End Interview</h3>
                <p className="text-sm text-red-700 mb-4">
                  Once you end the interview, you won't be able to come back to it.
                </p>
                <Button
                  onClick={endInterview}
                  variant="destructive"
                  className="w-full"
                  disabled={status !== 'active'}
                >
                  {status === 'completed' ? 'Interview Completed' : 'End Interview'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInterview;