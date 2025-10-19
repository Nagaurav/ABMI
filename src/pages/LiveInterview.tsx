import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { useToast } from '../components/ui/use-toast';
import useMediaPipe from '../hooks/useMediaPipe';
import useAudioAnalysis from '../hooks/useAudioAnalysis';

interface InterviewQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface InterviewSession {
  id: string;
  user_id: string;
  status: 'preparing' | 'in_progress' | 'completed' | 'cancelled';
  started_at: string;
  ended_at: string | null;
  feedback: any;
  created_at: string;
  updated_at: string;
}

const LiveInterview = () => {
  const user = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [interviewSession, setInterviewSession] = useState<InterviewSession | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  // Refs
  const webcamRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Custom hooks
  const {
    isModelLoading,
    startDetection,
    stopDetection,
    analyzeFace,
    analyzePose
  } = useMediaPipe(webcamRef);

  const {
    startAudioAnalysis,
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
      
      // Update session status to 'completed'
      const { error } = await supabase
        .from('interview_sessions')
        .update({ 
          status: 'completed', 
          ended_at: new Date().toISOString(),
          feedback: { 
            message: 'Interview completed successfully',
            duration_seconds: timeElapsed,
            questions_answered: questions.length
          }
        })
        .eq('id', interviewSession.id);

      if (error) throw error;
      
      // Show completion message
      toast({
        title: 'Interview Completed',
        description: 'Your interview has been submitted successfully!',
      });
      
      // Navigate to dashboard
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Error ending interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to end interview. Please try again.',
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
      
      if (webcamRef.current?.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      stopDetection();
      stopAudioAnalysis();
    };
  }, [initializeInterview, stopDetection, stopAudioAnalysis]);
  
  // Show loading state while initializing
  if (isLoading || isModelLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing interview session...</p>
        </div>
      </div>
    );
  }
  
  // Show error state if initialization failed
  if (initializationError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Initialization Error</h2>
          <p className="text-gray-600 mb-6">{initializationError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Format time (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Live Interview</h1>
          <p className="text-gray-600 mt-2">Practice your interview skills with real-time feedback</p>
        </header>

        {!isInterviewActive ? (
          /* Pre-interview setup */
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Interview Setup</h2>
            <p className="mb-6">Please allow access to your camera and microphone to begin the interview.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center h-64">
                <video 
                  ref={webcamRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="h-full w-full object-cover rounded"
                />
              </div>
              
              <div className="flex flex-col justify-between">
                <div>
                  <h3 className="font-medium mb-2">Interview Details</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Duration: ~30 minutes</li>
                    <li>• Questions: {questions.length} total</li>
                    <li>• Categories: Technical, Behavioral, Problem-Solving</li>
                    <li>• Real-time feedback on your performance</li>
                  </ul>
                </div>
                
                <div className="mt-6">
                  <Button 
                    onClick={startInterview} 
                    className="w-full"
                    disabled={isModelLoading}
                  >
                    {isModelLoading ? 'Loading AI models...' : 'Start Interview'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active interview */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Question and notes */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Question {questions.findIndex(q => q.id === currentQuestion?.id) + 1} of {questions.length}</span>
                    <h2 className="text-xl font-semibold mt-1">{currentQuestion?.category} Question</h2>
                  </div>
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {formatTime(timeElapsed)}
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <p className="text-lg">{currentQuestion?.question}</p>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleNextQuestion}>
                    Skip Question
                  </Button>
                  <Button onClick={handleEndInterview} variant="destructive">
                    End Interview
                  </Button>
                </div>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-medium mb-4">Your Notes</h3>
                <textarea 
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Take notes during your interview..."
                />
              </Card>
            </div>
            
            {/* Right column - Video feed and feedback */}
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <div className="relative aspect-video bg-black">
                  <video 
                    ref={webcamRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Confidence</span>
                    <span className="text-sm font-medium">75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-medium mb-4">Real-time Feedback</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Eye Contact</span>
                      <span className="text-sm text-gray-500">Good</span>
                    </div>
                    <Progress value={80} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Posture</span>
                      <span className="text-sm text-gray-500">Needs Improvement</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Speech Clarity</span>
                      <span className="text-sm text-gray-500">Excellent</span>
                    </div>
                    <Progress value={90} className="h-2" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveInterview;