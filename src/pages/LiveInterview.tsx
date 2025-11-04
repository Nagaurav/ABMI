import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Video, VideoOff, Mic, MicOff, Frown, Eye } from 'lucide-react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import useMediaPipe from '@/hooks/useMediaPipe';
import useAudioAnalysis from '@/hooks/useAudioAnalysis';

// Type definitions
interface InterviewQuestion {
  id: string;
  question: string;
  text?: string;
  category: string;
  timeLimit?: number;
  time_limit?: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | string | null;
  order_index?: number | null;
  session_id?: string | null;
  answer_transcript?: string | null;
  created_at?: string | null;
  [key: string]: any; // Allow additional properties
}

//

type InterviewStatus = 'idle' | 'starting' | 'active' | 'completing' | 'completed' | 'error';
type FeedbackType = 'eye_contact' | 'posture' | 'volume' | 'pace' | 'filler_words';

interface FeedbackItem {
  id?: string;
  type: FeedbackType;
  message: string;
  isPositive?: boolean;
  is_positive?: boolean;
  timestamp: Date | string;
  metadata?: Record<string, any>;
  created_at?: string;
  session_id?: string;
}

declare global {
  interface Window {
    MediaRecorder: any;
  }
}

const LiveInterview: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [user, setUser] = useState<any>(null);
  
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // State
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeFilePath, setResumeFilePath] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string>('');
  const [resumeInputMethod, setResumeInputMethod] = useState<'upload' | 'text'>('upload');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // MediaPipe hooks
  const mediaPipe = useMediaPipe(webcamRef as unknown as React.RefObject<HTMLVideoElement>);
  const {
    startDetection,
    stopDetection,
    analyzeFace,
    analyzePose
  } = mediaPipe || {};

  // Get user session
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('User session found:', session.user);
        setUser(session.user);
      } else {
        console.log('No session found, redirecting to login');
        navigate('/login');
      }
    };
    getUser();
  }, [navigate]);

  // Audio analysis
  const audioAnalysis = useAudioAnalysis();
  const {
    startAudioAnalysis,
    stopAudioAnalysis,
    getAudioAnalysis
  } = audioAnalysis || {};

  // Check for existing resume on mount
  useEffect(() => {
    const checkExistingResume = async () => {
      if (!user) {
        console.log('No user found on mount');
        return;
      }

      console.log('Checking for existing resume for user:', user.id);
      
      try {
        const { data, error } = await supabase
          .from('user_resumes' as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle instead of single to handle no results

        if (error) {
          console.error('Error checking resume:', error);
          // If it's a 406 error, the table might not exist or have RLS issues
          if (error.message.includes('406') || error.message.includes('Not Acceptable')) {
            console.warn('user_resumes table might not exist or have RLS policy issues');
          }
          return;
        }

        if (data) {
          console.log('Found existing resume:', data);
          setResumeFilePath((data as any).file_path);
          setResumeUploaded(true);
          setResumeFile({ name: (data as any).file_name } as File);
        } else {
          console.log('No existing resume found');
        }
      } catch (err) {
        console.error('Error checking existing resume:', err);
      }
    };

    checkExistingResume();
  }, [user]);

  // Log feedback to the database
  const logRealtimeFeedbackToDB = useCallback(async (
    type: string, 
    message: string, 
    isPositive: boolean,
    metadata: Record<string, any> = {}
  ) => {
    if (!sessionId) return;
    await supabase.from('feedback_logs').insert({
      session_id: sessionId,
      type,
      message,
      is_positive: isPositive,
      timestamp: new Date().toISOString(),
      metadata: metadata as any,
    }).then(({ error }) => {
      if (error) {
        console.warn('Failed to log feedback to DB:', error);
      }
    });
  }, [sessionId]);

  // Add feedback to the list
  const addFeedback = useCallback((item: Omit<FeedbackItem, 'id'>) => {
    setFeedback(prev => {
      const isDuplicate = prev.some(f => 
        f.type === item.type && 
        f.message === item.message &&
        (new Date().getTime() - formatTimestamp(f.timestamp)) < 10000
      );
      if (isDuplicate) return prev;
      return [...prev.slice(-9), { ...item, id: Date.now().toString() }];
    });
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) return;

    try {
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
            // addFeedback will be defined later, use setFeedback directly for now
            setFeedback(prev => {
              const isDuplicate = prev.some(f => 
                f.type === data.feedback_type && 
                f.message === data.message &&
                (new Date().getTime() - formatTimestamp(f.timestamp)) < 10000
              );
              if (isDuplicate) return prev;
              return [...prev.slice(-9), { 
                type: data.feedback_type,
                message: data.message,
                isPositive: data.is_positive,
                timestamp: new Date(),
                id: Date.now().toString()
              }];
            });
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        wsRef.current = null;
        // Only try to reconnect if we're still in an active interview and WebSocket server exists
        if (status === 'active') {
          // Don't auto-reconnect if server doesn't support WebSocket
          // The app can work without WebSocket
        }
      };
      
      ws.onerror = (error) => {
        console.warn('WebSocket connection failed (this is okay if server doesn\'t support WebSocket):', error);
        // Don't set error state - app can work without WebSocket
        wsRef.current = null;
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.warn('WebSocket not available:', err);
      // Don't set error state - app can work without WebSocket
    }
  }, [sessionId, status, user?.id]);

  // Set up cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle media analysis results
  useEffect(() => {
    if (status !== 'active' || !analyzeFace || !analyzePose) return;
    let isCancelled = false;
    const run = async () => {
      const faceResults = await analyzeFace();
      const poseResults = await analyzePose();
      if (!isCancelled && faceResults?.expressions && faceResults.isDetected) {
        const { eyeContact } = faceResults.expressions;
        if (eyeContact === false) {
          const feedback = {
            type: 'eye_contact' as const,
            message: 'Try to maintain eye contact with the camera',
            isPositive: false,
            timestamp: new Date()
          };
          addFeedback(feedback);
          logRealtimeFeedbackToDB(feedback.type, feedback.message, feedback.isPositive, { eyeContact });
        }
      }
      if (!isCancelled && poseResults?.posture && poseResults.isDetected) {
        const { posture } = poseResults;
        if (posture.shoulders !== 'aligned' || posture.back === 'hunched') {
          const feedback = {
            type: 'posture' as const,
            message: 'Sit up straight for better posture',
            isPositive: false,
            timestamp: new Date()
          };
          addFeedback(feedback);
          logRealtimeFeedbackToDB(feedback.type, feedback.message, feedback.isPositive, { posture });
        }
      }
      if (!isCancelled && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'analysis_data',
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          data: { face: faceResults, pose: poseResults }
        }));
      }
    };
    run();
    return () => { isCancelled = true; };
  }, [analyzeFace, analyzePose, sessionId, status, addFeedback, logRealtimeFeedbackToDB]);

  // Handle audio analysis results
  useEffect(() => {
    if (status !== 'active' || !getAudioAnalysis) return;
    
    const audioResults = getAudioAnalysis();
    
    // Check for speaking volume
    if (audioResults.volume < 0.1) {
      const feedback = {
        type: 'volume' as const,
        message: 'Speak up a bit',
        isPositive: false,
        timestamp: new Date()
      };
      addFeedback(feedback);
      logRealtimeFeedbackToDB(feedback.type, feedback.message, feedback.isPositive, { volume: audioResults.volume });
    } else if (audioResults.volume > 0.9) {
      const feedback = {
        type: 'volume' as const,
        message: 'You\'re speaking too loudly',
        isPositive: false,
        timestamp: new Date()
      };
      addFeedback(feedback);
      logRealtimeFeedbackToDB(feedback.type, feedback.message, feedback.isPositive, { volume: audioResults.volume });
    }
    
    // Check for speaking rate (words per minute)
    if (audioResults.speechRate > 150) {
      const feedback = {
        type: 'pace' as const,
        message: 'Try to speak a bit slower',
        isPositive: false,
        timestamp: new Date()
      };
      addFeedback(feedback);
      logRealtimeFeedbackToDB(feedback.type, feedback.message, feedback.isPositive, { speechRate: audioResults.speechRate });
    } else if (audioResults.speechRate < 80 && audioResults.isSpeaking) {
      const feedback = {
        type: 'pace' as const,
        message: 'Try to speak a bit faster',
        isPositive: false,
        timestamp: new Date()
      };
      addFeedback(feedback);
      logRealtimeFeedbackToDB(feedback.type, feedback.message, feedback.isPositive, { speechRate: audioResults.speechRate });
    }

  }, [getAudioAnalysis, status]);

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

  // Generate questions from resume using Gemini AI
  const generateQuestionsFromResume = async (): Promise<InterviewQuestion[]> => {
    try {
      console.log('Generating questions from resume...');
      
      // Get Gemini API key from environment
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
      }

      // Determine resume content source
      let resumeContent = '';
      
      if (resumeInputMethod === 'text' && resumeText.trim()) {
        // Use text input
        console.log('Using text input resume content');
        resumeContent = resumeText.trim();
      } else if (resumeInputMethod === 'upload' && resumeFilePath) {
        // Use server-side PDF parsing
        console.log('Using server-side PDF parsing for:', resumeFilePath);
        
        try {
          // Get signed URL for the PDF
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('interview-files')
            .createSignedUrl(resumeFilePath, 3600);
          
          if (signedUrlError) {
            throw new Error(`Failed to get signed URL: ${signedUrlError.message}`);
          }
          
          // Call our server-side PDF parsing API
          const parseResponse = await fetch('/api/parse-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pdfUrl: signedUrlData.signedUrl
            }),
          });
          
          if (!parseResponse.ok) {
            throw new Error(`PDF parsing failed: ${parseResponse.statusText}`);
          }
          
          const parseResult = await parseResponse.json();
          
          if (!parseResult.success) {
            throw new Error(parseResult.details || 'PDF parsing failed');
          }
          
          resumeContent = parseResult.text;
          console.log('Successfully parsed PDF content:', resumeContent.substring(0, 200) + '...');
          
        } catch (pdfError: any) {
          console.error('PDF parsing failed:', pdfError);
          throw new Error(`Failed to parse PDF: ${pdfError.message}`);
        }
      } else {
        throw new Error('No resume content available');
      }

      // Create the prompt for Gemini
      const prompt = `
You are an expert technical interviewer. Based on the following resume content, generate 5 personalized interview questions that are SPECIFICALLY tailored to this candidate's background.

Resume content:
${resumeContent}

IMPORTANT INSTRUCTIONS:
- Analyze the resume carefully and identify specific technologies, projects, companies, roles, and achievements mentioned
- Generate questions that reference specific details from the resume (e.g., "I see you worked with React at Company X...")
- Mix technical questions (60%) with behavioral questions (40%)
- Avoid generic HR questions like "Tell me about yourself" or "What are your strengths"
- Make questions challenging and relevant to their actual experience level
- Reference specific technologies, projects, or experiences mentioned in the resume

Please generate questions in the following JSON format:
[
  {
    "question": "Question text here that references specific resume details",
    "category": "Technical|Behavioral|Experience|Project",
    "difficulty": "easy|medium|hard",
    "timeLimit": 120
  }
]

Example of good questions:
- "I noticed you used Python for data analysis at [Company]. Can you walk me through how you optimized performance for large datasets?"
- "Your resume mentions leading a team of 5 developers on the [Project] project. What was your biggest challenge in that leadership role?"

Return only the JSON array, no additional text.
`;

      // Call Gemini API directly from client
      console.log('Calling Gemini API with key:', GEMINI_API_KEY ? 'Key present' : 'Key missing');
      
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('Gemini API error details:', {
          status: geminiResponse.status,
          statusText: geminiResponse.statusText,
          error: errorText
        });
        throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText} - ${errorText}`);
      }

      const geminiData = await geminiResponse.json();
      console.log('Full Gemini response:', geminiData);
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      console.log('Gemini response text:', text);
      console.log('Resume text that was sent to AI:', resumeText.substring(0, 500) + '...');

      // Parse the JSON response
      let questions;
      try {
        // Clean the response text (remove any markdown formatting)
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        questions = JSON.parse(cleanText);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        // Fallback to default questions if parsing fails
        questions = [
          {
            question: "Tell me about your professional background and experience.",
            category: "General",
            difficulty: "easy",
            timeLimit: 120
          },
          {
            question: "Describe a challenging project you've worked on and how you overcame obstacles.",
            category: "Experience",
            difficulty: "medium",
            timeLimit: 180
          },
          {
            question: "What technical skills do you consider your strongest, and can you provide an example of how you've applied them?",
            category: "Technical",
            difficulty: "medium",
            timeLimit: 150
          },
          {
            question: "How do you handle working under pressure and tight deadlines?",
            category: "Behavioral",
            difficulty: "medium",
            timeLimit: 120
          },
          {
            question: "Where do you see yourself in the next 3-5 years, and how does this role align with your career goals?",
            category: "General",
            difficulty: "easy",
            timeLimit: 120
          }
        ];
      }

      // Validate questions array
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format received from AI');
      }

      console.log('Generated questions:', questions);
      
      return questions.map((q: any, index: number) => ({
        id: `generated-${index + 1}`,
        question: q.question,
        category: q.category || 'General',
        timeLimit: q.timeLimit || 120,
        difficulty: q.difficulty || 'medium'
      }));
    } catch (error) {
      console.error('Error generating questions from resume:', error);
      throw error;
    }
  };

  // Load interview questions
  const loadQuestions = useCallback(async () => {
    try {
      // First, try to generate questions from resume (either uploaded file or text input)
      if (resumeUploaded && (resumeFilePath || resumeText.trim())) {
        try {
          console.log('Attempting to generate personalized questions from resume...');
          
          // Generate questions directly (the function handles both PDF and text internally)
          const generatedQuestions = await generateQuestionsFromResume();
          
          if (generatedQuestions.length > 0) {
            console.log('Successfully generated personalized questions!');
            setQuestions(generatedQuestions);
            setCurrentQuestion(generatedQuestions[0]);
            return;
          }
        } catch (error) {
          console.warn('Failed to generate questions from resume, falling back to database/defaults:', error);
        }
      }

      // Fallback to database questions
      const { data, error } = await supabase
        .from('interview_questions')
        .select('*')
        .order('difficulty', { ascending: true });
      
      if (error) {
        // If table doesn't exist, use default questions
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          const defaultQuestions: InterviewQuestion[] = [
            {
              id: '1',
              question: 'Tell me about yourself.',
              category: 'General',
              timeLimit: 120,
              difficulty: 'easy'
            },
            {
              id: '2',
              question: 'What are your strengths and weaknesses?',
              category: 'Behavioral',
              timeLimit: 150,
              difficulty: 'medium'
            },
            {
              id: '3',
              question: 'Describe a challenging project you worked on.',
              category: 'Technical',
              timeLimit: 180,
              difficulty: 'medium'
            }
          ];
          setQuestions(defaultQuestions);
          setCurrentQuestion(defaultQuestions[0]);
          return;
        }
        throw error;
      }
      
      setQuestions(data || []);
      
      // Set first question
      if (data?.length > 0) {
        setCurrentQuestion(data[0]);
      } else {
        // If no questions in database, use defaults
        const defaultQuestions: InterviewQuestion[] = [
          {
            id: '1',
            question: 'Tell me about yourself.',
            category: 'General',
            timeLimit: 120,
            difficulty: 'easy'
          }
        ];
        setQuestions(defaultQuestions);
        setCurrentQuestion(defaultQuestions[0]);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
      // Don't set status to error, just log it and continue with defaults
      const defaultQuestions: InterviewQuestion[] = [
        {
          id: '1',
          question: 'Tell me about yourself.',
          category: 'General',
          timeLimit: 120,
          difficulty: 'easy'
        }
      ];
      setQuestions(defaultQuestions);
      setCurrentQuestion(defaultQuestions[0]);
    }
  }, [resumeUploaded, resumeFilePath, user?.id]);

  // Start the interview
  const startInterview = useCallback(async (currentStatus?: string) => {
    const statusToCheck = currentStatus || status;
    console.log('startInterview called with:', { status: statusToCheck, userId: user?.id, hasUser: !!user });
    if (statusToCheck !== 'starting' || !user?.id) {
      console.log('Cannot start interview - conditions not met:', { 
        status: statusToCheck, 
        expectedStatus: 'starting',
        statusMatch: statusToCheck === 'starting',
        userId: user?.id, 
        hasUser: !!user?.id 
      });
      return;
    }
    
    try {
      // Create a new interview session
      const { data: session, error } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: user.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
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
      startDetection?.();
      startAudioAnalysis?.();
      
      setStatus('active');
      showToast('Interview started', 'success');
      
    } catch (err) {
      console.error('Error starting interview:', err);
      setError('Failed to start interview. Please try again.');
      setStatus('error');
    }
  }, [user, status, mediaStreamRef, webcamRef, startDetection, startAudioAnalysis, showToast]);

  // Handle resume upload
  const handleResumeUpload = async (file: File) => {
    console.log('User object:', user);
    if (!user) {
      showToast('Please log in to upload resume', 'error');
      console.error('No user found');
      return;
    }

    setIsUploadingResume(true);
    try {
      // Upload resume to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`; // Use user ID as folder
      
      console.log('Uploading file:', { fileName, filePath, userId: user.id });

      // Try to upload to interview-files bucket, fallback to avatars bucket
      let uploadError;
      let bucketUsed = 'interview-files';
      
      const uploadResult = await supabase.storage
        .from('interview-files')
        .upload(filePath, file);
      
      if (uploadResult.error) {
        console.log('interview-files bucket failed, trying avatars bucket...');
        bucketUsed = 'avatars';
        const fallbackResult = await supabase.storage
          .from('avatars')
          .upload(filePath, file);
        uploadError = fallbackResult.error;
      } else {
        uploadError = uploadResult.error;
      }

      if (uploadError) throw uploadError;

      // Get public URL from the bucket that was used
      const { data: { publicUrl } } = supabase.storage
        .from(bucketUsed)
        .getPublicUrl(filePath);
        
      console.log(`Resume uploaded to ${bucketUsed} bucket:`, publicUrl);

      // Save resume info to database
      const { error: dbError } = await supabase
        .from('user_resumes' as any)
        .upsert({
          user_id: user.id,
          file_path: filePath,
          file_url: publicUrl,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error('Database error:', dbError);
        // Don't throw error for database issues - file is still uploaded to storage
        console.warn('Resume uploaded to storage but failed to save metadata to database');
      }

      console.log('Resume uploaded to:', publicUrl);

      setResumeFilePath(filePath);
      setResumeUploaded(true);
      showToast('Resume uploaded successfully!', 'success');
    } catch (err: any) {
      console.error('Error uploading resume:', err);
      showToast('Failed to upload resume. Please try again.', 'error');
    } finally {
      setIsUploadingResume(false);
    }
  };

  // Handle camera and microphone permission request
  const requestPermissions = async () => {
    console.log('requestPermissions function called from UI button');
    setIsRequestingPermissions(true);
    setError(null);

    try {
      console.log('Requesting camera and microphone permissions from UI...');
      
      // Check if browser supports media devices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not supported in this browser');
      }

      // Add timeout for media device access
      const mediaPromise = navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Set a timeout for the media device request
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Media device access timed out. Please check your camera/mic permissions.')), 10000)
      );

      // Race between the media promise and the timeout
      const stream = await Promise.race([mediaPromise, timeoutPromise]) as MediaStream;

      console.log('Media devices accessed successfully');
      mediaStreamRef.current = stream;

      // Log available tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      console.log('Video tracks:', videoTracks.map(t => ({
        id: t.id,
        label: t.label,
        readyState: t.readyState,
        enabled: t.enabled
      })));
      console.log('Audio tracks:', audioTracks.map(t => ({
        id: t.id,
        label: t.label,
        readyState: t.readyState,
        enabled: t.enabled
      })));

      // Check if we actually got the required tracks
      if (videoTracks.length === 0) {
        console.warn('No video tracks available');
      }
      if (audioTracks.length === 0) {
        console.warn('No audio tracks available');
      }

      // Initially mute both audio and video (like Google Meet/Zoom)
      videoTracks.forEach(track => track.enabled = false);
      audioTracks.forEach(track => track.enabled = false);
      setIsVideoOn(false);
      setIsMuted(true);

      console.log('Setting permissionsGranted to true');
      setPermissionsGranted(true);
      showToast('Camera and microphone access granted!', 'success');

    } catch (err: any) {
      console.error('Error requesting permissions:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        constraint: err.constraint,
        permissionDenied: err.name === 'NotAllowedError',
        notFound: err.name === 'NotFoundError',
        notReadable: err.name === 'NotReadableError',
        overConstrained: err.name === 'OverconstrainedError',
        security: err.name === 'SecurityError',
        type: err.type
      });

      let errorMessage = 'Failed to access camera/microphone. ';

      switch (err.name) {
        case 'NotAllowedError':
          errorMessage += 'Permission was denied. Please allow access to continue.';
          break;
        case 'NotFoundError':
          errorMessage += 'No camera or microphone found. Please check your devices.';
          break;
        case 'NotReadableError':
          errorMessage += 'Camera/microphone is being used by another application.';
          break;
        case 'OverconstrainedError':
          errorMessage += `Device constraints could not be satisfied: ${err.constraint}`;
          break;
        case 'SecurityError':
          errorMessage += 'Security restrictions prevent accessing the devices.';
          break;
        default:
          errorMessage += err.message || 'Please check your permissions and try again.';
      }

      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  // Handle resume deletion
  const handleResumeDelete = async () => {
    if (!user || !resumeFilePath) return;

    setIsUploadingResume(true);
    try {
      // Delete from storage - try both buckets
      let storageError;
      const deleteFromInterviewFiles = await supabase.storage
        .from('interview-files')
        .remove([resumeFilePath]);
      
      if (deleteFromInterviewFiles.error) {
        console.log('Trying to delete from avatars bucket...');
        const deleteFromAvatars = await supabase.storage
          .from('avatars')
          .remove([resumeFilePath]);
        storageError = deleteFromAvatars.error;
      } else {
        storageError = deleteFromInterviewFiles.error;
      }

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_resumes' as any)
        .delete()
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // Reset state
      setResumeFile(null);
      setResumeFilePath(null);
      setResumeUploaded(false);
      showToast('Resume removed successfully', 'success');
    } catch (err: any) {
      console.error('Error deleting resume:', err);
      showToast('Failed to remove resume. Please try again.', 'error');
    } finally {
      setIsUploadingResume(false);
    }
  };

  // Start interview process - called when user clicks the Start Interview button
  const startInterviewProcess = useCallback(async () => {
    console.log('startInterviewProcess called with state:', {
      status,
      resumeUploaded,
      permissionsGranted
    });

    if (status !== 'idle') return;

    // Check if resume is uploaded
    if (!resumeUploaded) {
      console.log('Resume not uploaded');
      showToast('Please upload your resume first', 'error');
      return;
    }

    // Check if permissions are granted
    if (!permissionsGranted) {
      console.log('Permissions not granted, permissionsGranted:', permissionsGranted);
      showToast('Please grant camera and microphone permissions first', 'error');
      return;
    }
    
    console.log('Starting interview process...');
    setStatus('starting');
    setError(null);
    
    try {
      // Try to initialize WebSocket connection (optional)
      try {
        console.log('Initializing WebSocket connection...');
        connectWebSocket();
      } catch (wsErr) {
        console.warn('WebSocket initialization failed, continuing without it:', wsErr);
      }
      
      // Generate personalized questions based on resume
      console.log('Generating personalized interview questions...');
      await loadQuestions();
      
      // Begin interview flow (creates session, starts analysis)
      console.log('Starting interview flow...');
      await startInterview('starting');
      
    } catch (err: any) {
      console.error('Error initializing interview:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        constraint: err.constraint,
        permissionDenied: err.name === 'NotAllowedError',
        notFound: err.name === 'NotFoundError',
        notReadable: err.name === 'NotReadableError',
        overConstrained: err.name === 'OverconstrainedError',
        security: err.name === 'SecurityError',
        type: err.type
      });
      
      let errorMessage = 'Failed to initialize interview. ';
      
      switch (err.name) {
        case 'NotAllowedError':
          errorMessage += 'Camera/microphone access was denied. Please allow access to continue.';
          break;
        case 'NotFoundError':
          errorMessage += 'No media tracks found. Please check your camera/microphone connections.';
          break;
        case 'NotReadableError':
          errorMessage += 'Could not access camera/microphone. Another application might be using it.';
          break;
        case 'OverconstrainedError':
          errorMessage += `Constraints could not be satisfied: ${err.constraint}`;
          break;
        case 'SecurityError':
          errorMessage += 'Security restrictions prevent accessing the camera/microphone.';
          break;
        default:
          errorMessage += err.message || 'Please check your permissions and try again.';
      }
      
      setError(errorMessage);
      setStatus('error');
    }
  }, [loadQuestions, startInterview, status, connectWebSocket, resumeUploaded, permissionsGranted, showToast]);

  // Trigger analysis for the interview
  const triggerAnalysis = async (sessionId: string) => {
    try {
      const response = await fetch('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start analysis');
      }

      return data;
    } catch (error) {
      console.error('Error triggering analysis:', error);
      throw error;
    }
  };

  // End the interview
  const endInterview = useCallback(async () => {
    if (status !== 'active') return;
    
    setStatus('completing');
    
    try {
      // Stop media recording and analysis
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      stopDetection?.();
      stopAudioAnalysis?.();
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Update session status to completed
      if (sessionId) {
        await supabase
          .from('interview_sessions')
          .update({
            status: 'pending_analysis',
            ended_at: new Date().toISOString(),
            duration_seconds: timeElapsed
          } as any) // Type assertion to handle strict type checking
          .eq('id', sessionId);

        // Trigger analysis
        await triggerAnalysis(sessionId);
      }
      
      setStatus('completed');
      
      showToast('Interview completed', 'success');
      
      // Redirect to analysis page after a short delay
      setTimeout(() => {
        navigate(`/analysis/${sessionId}`);
      }, 2000);
    } catch (error) {
      console.error('Error ending interview:', error);
      setError('Failed to complete interview. Please try again.');
      setStatus('error');
      
      showToast('Failed to complete interview. Please try again.', 'error');
    }
  }, [status, sessionId, timeElapsed, stopDetection, stopAudioAnalysis, wsRef, navigate]);

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
        .update({ recording_url: publicUrl } as any)
        .eq('id', sessionId);
      
      console.log('Recording uploaded successfully:', publicUrl);
    } catch (err) {
      console.error('Error uploading recording:', err);
    }
  };

  

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  }, [mediaStreamRef]);

  // Toggle microphone on/off
  const toggleMicrophone = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, [mediaStreamRef]);

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format timestamp for feedback
  const formatTimestamp = (date: Date | string): number => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.getTime();
  };

  // Render start screen
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-white mb-6">Welcome to Your Interview</h1>
          
          {/* Resume Input Section */}
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Provide Your Resume</h2>
            <p className="text-gray-300 text-sm mb-4">
              We'll analyze your resume to generate personalized interview questions tailored to your experience.
            </p>
            
            {/* Method Selection Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-700/50 rounded-lg p-1">
              <button
                onClick={() => setResumeInputMethod('upload')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  resumeInputMethod === 'upload'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                }`}
              >
                Upload PDF
              </button>
              <button
                onClick={() => setResumeInputMethod('text')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  resumeInputMethod === 'text'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                }`}
              >
                Paste Text
              </button>
            </div>
            
            {!resumeUploaded ? (
              <div className="space-y-4">
                {resumeInputMethod === 'upload' ? (
                  /* PDF Upload Section */
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      id="resume-upload"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setResumeFile(file);
                          handleResumeUpload(file);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="resume-upload" className="cursor-pointer">
                      <svg className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-white font-medium mb-1">
                        {isUploadingResume ? 'Uploading...' : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-gray-400 text-sm">PDF, DOC, or DOCX (Max 10MB)</p>
                    </label>
                  </div>
                ) : (
                  /* Text Input Section */
                  <div className="space-y-4">
                    <textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste your resume content here..."
                      className="w-full h-64 p-4 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          if (resumeText.trim().length > 50) {
                            setResumeUploaded(true);
                            showToast('Resume content saved!', 'success');
                          } else {
                            showToast('Please enter at least 50 characters of resume content', 'error');
                          }
                        }}
                        disabled={resumeText.trim().length < 50}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Save Resume Content
                      </Button>
                    </div>
                  </div>
                )}
                
                {resumeFile && resumeInputMethod === 'upload' && (
                  <div className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-gray-300 text-sm">{resumeFile.name}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-green-400 font-medium">Resume uploaded successfully!</p>
                      <p className="text-gray-400 text-sm">{resumeFile?.name}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResumeDelete}
                    disabled={isUploadingResume}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-gray-400 text-sm">We're ready to generate your personalized questions.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResumeInputMethod('text');
                      setResumeUploaded(false);
                    }}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    Or use text input instead
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Camera and Microphone Permission Section */}
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Camera & Microphone Access</h2>
            <p className="text-gray-300 text-sm mb-4">
              We need access to your camera and microphone for the interview. Both will be turned off by default.
            </p>
            
            {!permissionsGranted ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg">
                  <div className="text-center">
                    <div className="flex justify-center space-x-4 mb-4">
                      <div className="p-3 bg-gray-700 rounded-full">
                        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="p-3 bg-gray-700 rounded-full">
                        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-4">Camera and microphone access required</p>
                    <Button
                      onClick={requestPermissions}
                      disabled={isRequestingPermissions}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isRequestingPermissions ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Requesting Access...
                        </>
                      ) : (
                        'Allow Camera & Microphone'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-center">
                <svg className="h-6 w-6 text-green-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-green-400 font-medium">Camera and microphone access granted!</p>
                  <p className="text-gray-400 text-sm">Both devices are currently turned off. You can enable them during the interview.</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Before You Begin</h2>
            <ul className="text-left space-y-3 mb-6 text-gray-300">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Ensure you're in a quiet, well-lit environment</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Check that your camera and microphone are working</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Close any unnecessary applications</span>
              </li>
            </ul>
            
            <Button 
              onClick={startInterviewProcess}
              size="lg"
              disabled={!resumeUploaded || !permissionsGranted}
              className="w-full max-w-xs mx-auto py-6 text-lg font-semibold bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Interview
            </Button>
            {(!resumeUploaded || !permissionsGranted) && (
              <p className="text-yellow-400 text-sm mt-3 text-center">
                {!resumeUploaded && !permissionsGranted 
                  ? 'Please upload your resume and grant camera/microphone permissions'
                  : !resumeUploaded 
                  ? 'Please upload your resume first'
                  : 'Please grant camera and microphone permissions first'
                }
              </p>
            )}
          </div>
          
          <div className="text-sm text-gray-400">
            <p>By clicking "Start Interview", you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    );
  }

  // Render loading/initializing state
  if (status === 'starting') { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-blue-600/20 rounded-full animate-ping"></div>
            <div className="relative z-10 w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
              <svg className="h-8 w-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-3">Setting Up Your Interview</h2>
          <p className="text-gray-300 mb-8">Please wait while we prepare your interview environment.</p>
          
          <div className="space-y-4 max-w-xs mx-auto text-left">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center mr-3 mt-0.5">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-300">Initializing interview session</span>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-700 flex items-center justify-center mr-3 mt-0.5">
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-400">Connecting to video/audio</span>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-700 flex items-center justify-center mr-3 mt-0.5">
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-400">Loading interview questions</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Frown className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-300 mb-6">
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

  // Main render
  return (
    <div className="min-h-screen bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Live Interview</h1>
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
          <div className="lg:col-span-2 bg-gray-900/60 border border-gray-700 rounded-2xl overflow-hidden">
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
                <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
                  <VideoOff className="h-12 w-12 text-gray-500" />
                </div>
              )}

              {/* Video Controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                <Button
                  onClick={toggleCamera}
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-10 h-10 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200"
                >
                  {isVideoOn ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
                <Button
                  onClick={toggleMicrophone}
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-10 h-10 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200"
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
            <Card className="lg:col-span-2 bg-gray-900/60 border border-gray-700">
              <CardHeader className="border-b border-gray-700">
                <CardTitle className="text-lg font-medium text-gray-100">Current Question</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700">
                    <p className="text-gray-200">
                      {currentQuestion?.question || 'No question available'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Category: {currentQuestion?.category || 'N/A'}</span>
                    <span>Time Limit: {currentQuestion?.timeLimit || 0}s</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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

          {/* Feedback Panel */}
          <div className="space-y-4">
            <Card className="bg-gray-900/60 border border-gray-700 text-gray-100">
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
                              key={`${formatTimestamp(item.timestamp)}-${item.type}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-3 rounded-lg ${
                                item.isPositive ? 'bg-green-900/50 border border-green-700 text-green-200' : 'bg-amber-900/50 border border-amber-700 text-amber-200'
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
                                  <p className="text-sm font-medium">
                                    {item.message}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
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
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-900/50 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-500">Eye Contact</p>
                      <p className="text-sm font-medium">Monitoring...</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* End Interview Card */}
            <Card className="bg-red-900/50 border border-red-700">
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium text-red-200 mb-2">End Interview</h3>
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