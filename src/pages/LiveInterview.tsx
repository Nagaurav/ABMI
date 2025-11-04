import React, { useState, useRef, useEffect, useCallback } from 'react';
import ResumeInputSection from '@/components/interview/ResumeInputSection';
import { useNavigate } from 'react-router-dom';
// import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Video, VideoOff, Mic, MicOff, Frown, Volume2, VolumeX } from 'lucide-react';
import Webcam from 'react-webcam';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTtsMuted, setIsTtsMuted] = useState(false);
const [transcript, setTranscript] = useState(''); // <-- Live transcript state
  
  // Text-to-Speech function
  const speakQuestion = useCallback((text: string) => {
    if (isTtsMuted || !text) return; // Don't speak if muted or no text

    window.speechSynthesis.cancel(); // Cancel any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Uncomment to log TTS events
    // utterance.onstart = () => console.log('TTS started');
    // utterance.onend = () => console.log('TTS ended');
    
    window.speechSynthesis.speak(utterance);
  }, [isTtsMuted]);
  
  // Effect to speak question when it changes
  useEffect(() => {
    if (status === 'active' && currentQuestion?.question) {
      speakQuestion(currentQuestion.question);
    }
  }, [currentQuestion, status, speakQuestion]);
  
  // MediaPipe hooks
  const mediaPipe = useMediaPipe(videoRef);
  const {
    startDetection,
    stopDetection,
    analyzeFace,
    analyzePose,
    isModelLoading
  } = mediaPipe || {};
  
  // Debug MediaPipe status and browser compatibility
  useEffect(() => {
    const isEdge = navigator.userAgent.includes('Edg');
    const isChrome = navigator.userAgent.includes('Chrome') && !isEdge;
    const isFirefox = navigator.userAgent.includes('Firefox');
    
    console.log('🤖 MediaPipe status:', { 
      isModelLoading, 
      hasStartDetection: !!startDetection,
      hasAnalyzeFace: !!analyzeFace,
      hasAnalyzePose: !!analyzePose,
      browser: isEdge ? 'Edge' : isChrome ? 'Chrome' : isFirefox ? 'Firefox' : 'Other'
    });
    
    if (isEdge) {
      console.log('🌐 Microsoft Edge detected - using CPU backend for better compatibility');
      console.log('💡 For best performance, consider using Chrome or Firefox');
    }
  }, [isModelLoading, startDetection, analyzeFace, analyzePose]);

  // Get user session
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
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
        return;
      }
      
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
          setResumeFilePath((data as any).file_path);
          setResumeUploaded(true);
          setResumeFile({ name: (data as any).file_name } as File);
        }
      } catch (err) {
        console.error('Error checking existing resume:', err);
      }
    };

    checkExistingResume();
  }, [user]);


  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) return;

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/interview-stream`;
      
      // Attempt WebSocket connection (optional feature)
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ Live transcription enabled');
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
          // Try to parse as JSON, but if binary, skip
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            // Not JSON (likely binary audio), ignore
            return;
          }
          
          if (data.type === 'question') {
            setCurrentQuestion(data.question);
          } else if (data.type === 'transcript_update') {
            setTranscript(data.transcript);
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };
      
      ws.onclose = () => {
        wsRef.current = null;
        // Only try to reconnect if we're still in an active interview and WebSocket server exists
        if (status === 'active') {
          // Don't auto-reconnect if server doesn't support WebSocket
          // The app can work without WebSocket
        }
      };
      
      ws.onerror = () => {
        // Silently handle WebSocket errors - live transcription is optional
        wsRef.current = null;
      };
      
      wsRef.current = ws;
    } catch (err) {
      // Silently handle WebSocket initialization errors - it's an optional feature
      wsRef.current = null;
    }
  }, [sessionId, status, user?.id]);

  // Sync webcam stream with video element for MediaPipe
  useEffect(() => {
    const syncVideoStream = () => {
      if (webcamRef.current && videoRef.current && mediaStreamRef.current) {
        // Set the video element source to the same stream as webcam
        videoRef.current.srcObject = mediaStreamRef.current;
        console.log('🔄 Video stream synced for MediaPipe analysis');
        
        // Debug video element status
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded:', {
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight,
            readyState: videoRef.current?.readyState
          });
        };
      }
    };

    // Sync when media stream is available
    if (mediaStreamRef.current) {
      syncVideoStream();
    }

    // Also sync when permissions are granted and stream becomes available
    const interval = setInterval(() => {
      if (mediaStreamRef.current && videoRef.current && !videoRef.current.srcObject) {
        syncVideoStream();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [permissionsGranted, isVideoOn]);

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

  // Simplified analysis state
  const [analysisScores, setAnalysisScores] = useState({
    facial: 0, // 0-100 score
    posture: 0, // 0-100 score  
    voice: 0 // 0-100 score
  });

  // Simplified continuous analysis
  useEffect(() => {
    console.log('🎯 Analysis effect triggered, status:', status);
    if (status !== 'active') return;
    
    let analysisInterval: NodeJS.Timeout;
    
    const runSimpleAnalysis = async () => {
      try {
        console.log('🔄 Running analysis...');
        
        // Get analysis results
        const faceResults = analyzeFace ? await analyzeFace() : null;
        const poseResults = analyzePose ? await analyzePose() : null;
        const audioResults = getAudioAnalysis ? getAudioAnalysis() : null;
        
        console.log('📊 Analysis data:', { 
          faceResults: faceResults, 
          poseResults: poseResults,
          audioResults: audioResults
        });
        
        // Calculate real scores (0-100)
        let facialScore = 0;
        let postureScore = 0;
        let voiceScore = 0;
        
        // Facial analysis scoring
        if (faceResults?.isDetected && faceResults.expressions) {
          const { eyeContact, smile, headTilt } = faceResults.expressions;
          let facePoints = 0;
          
          console.log('👤 Face data:', { eyeContact, smile, headTilt });
          
          // Eye contact (40 points)
          if (eyeContact) facePoints += 40;
          else facePoints += 10;
          
          // Smile (30 points)
          facePoints += Math.min(30, smile * 30);
          
          // Head position (30 points)
          const tiltPenalty = Math.abs(headTilt.x) + Math.abs(headTilt.y);
          facePoints += Math.max(0, 30 - (tiltPenalty * 50));
          
          facialScore = Math.min(100, Math.max(0, facePoints));
        } else {
          // Fallback: Basic scoring when MediaPipe isn't working
          // Check if video is on and user has granted permissions
          if (isVideoOn && permissionsGranted) {
            facialScore = 60; // Assume moderate performance when video is active
          } else {
            facialScore = 20; // Low score when video is off
          }
        }
        
        // Posture analysis scoring
        if (poseResults?.isDetected && poseResults.posture) {
          const { shoulders, back, hands } = poseResults.posture;
          let posturePoints = 0;
          
          console.log('🧍 Pose data:', { shoulders, back, hands });
          
          // Shoulders (40 points)
          if (shoulders === 'aligned') posturePoints += 40;
          else posturePoints += 15;
          
          // Back (40 points)
          if (back === 'straight') posturePoints += 40;
          else posturePoints += 15;
          
          // Hands (20 points)
          if (hands === 'visible') posturePoints += 20;
          else posturePoints += 5;
          
          postureScore = Math.min(100, Math.max(0, posturePoints));
        } else {
          // Fallback: Basic scoring when MediaPipe isn't working
          if (isVideoOn && permissionsGranted) {
            postureScore = 65; // Assume good posture when video is active
          } else {
            postureScore = 25; // Low score when video is off
          }
        }
        
        // Voice analysis scoring
        if (audioResults) {
          let voicePoints = 0;
          
          console.log('🎤 Audio data:', audioResults);
          
          // Volume (40 points)
          if (audioResults.volume >= 0.3 && audioResults.volume <= 0.7) voicePoints += 40;
          else if (audioResults.volume >= 0.2 && audioResults.volume <= 0.8) voicePoints += 25;
          else voicePoints += 10;
          
          // Speech rate (40 points)
          if (audioResults.speechRate >= 100 && audioResults.speechRate <= 150) voicePoints += 40;
          else if (audioResults.speechRate >= 80 && audioResults.speechRate <= 180) voicePoints += 25;
          else voicePoints += 10;
          
          // Clarity (20 points)
          voicePoints += Math.min(20, audioResults.clarity * 20);
          
          voiceScore = Math.min(100, Math.max(0, voicePoints));
        } else {
          // Fallback: Basic scoring when audio analysis isn't working
          if (!isMuted && permissionsGranted) {
            voiceScore = 45; // Assume moderate voice quality when mic is active
          } else {
            voiceScore = 10; // Low score when muted
          }
        }
        
        // Update scores
        console.log('📈 Updating scores:', { facialScore, postureScore, voiceScore });
        setAnalysisScores({
          facial: facialScore,
          posture: postureScore,
          voice: voiceScore
        });
        
      } catch (error) {
        console.error('Error in analysis:', error);
      }
    };
    
    // Run analysis every 3 seconds
    console.log('⏰ Setting up analysis interval...');
    analysisInterval = setInterval(runSimpleAnalysis, 3000);
    runSimpleAnalysis();
    
    return () => {
      if (analysisInterval) {
        clearInterval(analysisInterval);
      }
    };
  }, [status, analyzeFace, analyzePose, getAudioAnalysis]);

  // Helper function to get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400 bg-green-400/20 border-green-400/30';
    if (score >= 40) return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
    return 'text-red-400 bg-red-400/20 border-red-400/30';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Perfect';
    if (score >= 40) return 'Moderate';
    return 'Poor';
  };


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

  // Parse PDF file client-side using pdfjs-dist
  const parsePDF = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source for pdfjs - use jsdelivr CDN (reliable npm package CDN)
    // This is a permanent solution that works with the exact version from package.json
    const pdfjsVersion = pdfjsLib.version || '5.4.394';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  };

  // Parse DOCX file client-side (basic text extraction)
  const parseDOCX = async (_file: File): Promise<string> => {
    // DOCX files are ZIP archives, so direct text reading won't work well
    // For proper DOCX parsing, users should convert to PDF or paste text directly
    throw new Error('DOCX parsing requires additional libraries. Please convert to PDF or paste text directly.');
  };

  // Extract text from file based on type
  const extractTextFromFile = async (file: File): Promise<string> => {
    const normalizedMime = (file.type || '').toLowerCase();

    // Primary detection via MIME type
    if (normalizedMime === 'application/pdf') {
      return await parsePDF(file);
    }
    if (normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await parseDOCX(file);
    }
    if (normalizedMime === 'text/plain') {
      return await file.text();
    }

    // Fallback: detect by file extension when MIME is missing/undefined
    const name = (file as any).name || '';
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return await parsePDF(file);
    }
    if (ext === 'docx') {
      return await parseDOCX(file);
    }
    if (ext === 'txt') {
      return await file.text();
    }

    // Final fallback: sniff bytes to detect PDF header
    try {
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const headString = Array.from(head).map((b) => String.fromCharCode(b)).join('');
      if (headString.startsWith('%PDF-')) {
        return await parsePDF(file);
      }
    } catch (_) {
      // ignore sniffing errors and try text next
    }

    // As a last resort, try reading as text
    try {
      return await file.text();
    } catch (e) {
      throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Please use PDF, DOCX, or TXT.`);
    }
  };

  // Call Gemini API directly to generate questions from resume text
  const callGeminiForQuestions = async (resumeText: string): Promise<string[]> => {
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.');
    }

    const prompt = `
You are an expert technical recruiter and interview coach.
You will be given the full text of a candidate's resume.
Your task is to analyze the resume and generate 10-15 insightful, personalized interview questions that probe their skills, experience, and project work.

Guidelines:
- Generate a mix of behavioral ("Tell me about a time..."), technical ("How would you..."), and project-specific questions.
- The questions should be directly based on the technologies, roles, and accomplishments listed in the resume.
- Do not ask basic "keyword" questions. Ask questions that force the candidate to elaborate on *how* they used their skills.
- Return ONLY a valid JSON array of strings, like ["question 1", "question 2"]. Do not include any other text or markdown.

Here is the resume text:
---
${resumeText}
---
`;

    // Use gemini-2.5-pro for best quality
    const modelName = 'gemini-2.5-pro';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the JSON string from Gemini's response
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!responseText) {
      throw new Error('No response text from Gemini API');
    }

    // Clean the response text (remove markdown formatting if present)
    const jsonString = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const questions = JSON.parse(jsonString);
      
      if (!Array.isArray(questions)) {
        throw new Error('Gemini response is not an array');
      }
      
      return questions;
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      console.error('Response text:', responseText);
      throw new Error('Failed to parse questions from Gemini response');
    }
  };

  // Generate questions from resume using client-side PDF parsing and direct Gemini API call
  const generateQuestionsFromResume = async (): Promise<InterviewQuestion[]> => {
    try {
      let extractedText = '';
      
      // Determine resume content source and extract text
      if (resumeInputMethod === 'text') {
        // Use text input directly from state
        extractedText = resumeText.trim();
        if (!extractedText) {
          throw new Error('Please enter resume text');
        }
      } else if (resumeInputMethod === 'upload' && resumeFilePath) {
        // Parse file client-side
        let fileToParse: File;
        
        if (!resumeFile) {
          // If file object is not available, fetch it from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('interview-files')
            .download(resumeFilePath);
          
          if (downloadError) {
            // Try avatars bucket as fallback
            const { data: fallbackData, error: fallbackError } = await supabase.storage
              .from('avatars')
              .download(resumeFilePath);
            
            if (fallbackError) {
              throw new Error(`Failed to download resume file: ${fallbackError.message}`);
            }
            
            fileToParse = new File([fallbackData], resumeFilePath.split('/').pop() || 'resume.pdf', { 
              type: fallbackData.type || 'application/pdf' 
            });
          } else {
            fileToParse = new File([fileData], resumeFilePath.split('/').pop() || 'resume.pdf', { 
              type: fileData.type || 'application/pdf' 
            });
          }
        } else {
          fileToParse = resumeFile;
        }
        
        // Extract text from file using client-side parser; fallback to server for PDFs
        try {
          extractedText = await extractTextFromFile(fileToParse);
        } catch (clientParseError) {
          console.warn('Client-side parse failed, attempting server-side PDF parse...', clientParseError);
          const name = (fileToParse as any).name || '';
          const ext = name.split('.').pop()?.toLowerCase();
          const isLikelyPdf = (fileToParse.type || '').includes('pdf') || ext === 'pdf';

          if (isLikelyPdf) {
            const form = new FormData();
            form.append('file', fileToParse);
            const resp = await fetch('/api/parse-pdf', {
              method: 'POST',
              body: form
            });
            if (!resp.ok) {
              const msg = await resp.text();
              throw new Error(`Server PDF parse failed: ${resp.status} ${resp.statusText} - ${msg}`);
            }
            const json = await resp.json();
            if (!json?.text) {
              throw new Error('Server PDF parse did not return text');
            }
            extractedText = String(json.text);
          } else {
            throw clientParseError;
          }
        }
      } else {
        throw new Error('No resume content available');
      }

      if (!extractedText.trim()) {
        throw new Error('Could not extract any text from the resume');
      }

      // Call Gemini API directly with extracted text
      const questionsArray = await callGeminiForQuestions(extractedText);

      if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
        throw new Error('No questions generated from Gemini');
      }

      // Map the questions to the expected format
      return questionsArray.map((q: string, index: number) => ({
        id: `generated-${index + 1}`,
        question: typeof q === 'string' ? q : String(q),
        category: 'General',
        timeLimit: 120,
        difficulty: 'medium' as const
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
          // Generate questions directly (the function handles both PDF and text internally)
          const generatedQuestions = await generateQuestionsFromResume();
          
          if (generatedQuestions.length > 0) {
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
    if (statusToCheck !== 'starting' || !user?.id) {
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
              // --- Send audio chunk to WebSocket for live transcription ---
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(event.data); // Send binary Blob
              }
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
      console.log('🎬 Starting MediaPipe detection...');
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
    if (!user) {
      showToast('Please log in to upload resume', 'error');
      return;
    }

    setIsUploadingResume(true);
    try {
      // Upload resume to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`; // Use user ID as folder

      // Try to upload to interview-files bucket, fallback to avatars bucket
      let uploadError;
      let bucketUsed = 'interview-files';
      
      const uploadResult = await supabase.storage
        .from('interview-files')
        .upload(filePath, file);
      
      if (uploadResult.error) {
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

      setResumeFilePath(filePath);
      setResumeFile(file); // Store the file object for later use
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
    setIsRequestingPermissions(true);
    setError(null);

    try {
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

      mediaStreamRef.current = stream;

      // Check available tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

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
    if (status !== 'idle') return;

    // Check if resume is uploaded
    if (!resumeUploaded) {
      showToast('Please upload your resume first', 'error');
      return;
    }

    // Check if permissions are granted
    if (!permissionsGranted) {
      showToast('Please grant camera and microphone permissions first', 'error');
      return;
    }
    
    setStatus('starting');
    setError(null);
    
    try {
      // Try to initialize WebSocket connection (optional)
      try {
        connectWebSocket();
      } catch (wsErr) {
        console.warn('WebSocket initialization failed, continuing without it:', wsErr);
      }
      
      // Generate personalized questions based on resume
      await loadQuestions();
      
      // Begin interview flow (creates session, starts analysis)
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

      // Check if response has content before trying to parse JSON
      const contentType = response.headers.get('content-type');
      let data = null;
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim()) {
          data = JSON.parse(text);
        }
      }
      
      if (!response.ok) {
        // Silently handle analysis API errors - it's an optional service
        return { warning: 'Analysis service unavailable' };
      }

      return data || { success: true };
    } catch (error) {
      // Silently handle analysis service errors - it's optional
      return { warning: 'Analysis service unavailable' };
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

        // Trigger analysis (optional - won't fail if service unavailable)
        await triggerAnalysis(sessionId);
      }
      
      setStatus('completed');
      
      showToast('Interview completed', 'success');
      
      // Redirect to analysis page after a short delay
      setTimeout(() => {
        // Try to navigate to session-specific analysis, fallback to dashboard
        if (sessionId) {
          navigate(`/analysis/${sessionId}`);
        } else {
          navigate('/dashboard');
        }
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


  // Render start screen
  if (status === 'idle') {
    return (
      <div className="space-y-8">
        <ResumeInputSection
          resumeInputMethod={resumeInputMethod}
          setResumeInputMethod={setResumeInputMethod}
          resumeUploaded={resumeUploaded}
          resumeFile={resumeFile}
          isUploadingResume={isUploadingResume}
          handleResumeUpload={handleResumeUpload}
          handleResumeDelete={handleResumeDelete}
          resumeText={resumeText}
          setResumeText={setResumeText}
          showToast={showToast}
          setResumeUploaded={setResumeUploaded}
        />
        {/* Camera and Microphone Permission Section */}
        {!permissionsGranted && (
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6 border border-gray-700 text-center">
            <p className="text-gray-300 mb-4">Camera and microphone access required</p>
            <Button
              onClick={requestPermissions}
              disabled={isRequestingPermissions}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRequestingPermissions ? 'Requesting...' : 'Allow Camera & Microphone'}
            </Button>
          </div>
        )}
        {/* Before You Begin Info Block */}
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
                : 'Please grant camera and microphone permissions first'}
            </p>
          )}
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
                <>
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
                  {/* Hidden video element for MediaPipe analysis */}
                  <video
                    ref={videoRef}
                    className="hidden"
                    autoPlay
                    muted
                    playsInline
                  />
                </>
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
                <Button
                  onClick={() => setIsTtsMuted(!isTtsMuted)}
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-10 h-10 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200"
                  title={isTtsMuted ? 'Unmute interviewer' : 'Mute interviewer'}
                >
                  {isTtsMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
              </div>

              {/* Timer */}
              <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                {formatTime(timeElapsed)}
              </div>
            </div>

          </div>

          {/* Real-time Analysis Panel */}
          <div className="space-y-4">
            <Card className="bg-gray-900/60 border border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Real-time Analysis</CardTitle>
                <p className="text-sm text-gray-400">Live performance monitoring</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Facial Expression Analysis */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm font-medium text-gray-200">Facial Expression</span>
                    </div>
                    <span className="text-xs text-gray-400">{analysisScores.facial}/100</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        analysisScores.facial >= 70 ? 'bg-green-500' : 
                        analysisScores.facial >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analysisScores.facial}%` }}
                    ></div>
                  </div>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScoreColor(analysisScores.facial)}`}>
                    {getScoreLabel(analysisScores.facial)}
                  </div>
                </div>

                {/* Posture Analysis */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-sm font-medium text-gray-200">Posture</span>
                    </div>
                    <span className="text-xs text-gray-400">{analysisScores.posture}/100</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        analysisScores.posture >= 70 ? 'bg-green-500' : 
                        analysisScores.posture >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analysisScores.posture}%` }}
                    ></div>
                  </div>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScoreColor(analysisScores.posture)}`}>
                    {getScoreLabel(analysisScores.posture)}
                  </div>
                </div>

                {/* Voice Analysis */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-200">Voice Quality</span>
                    </div>
                    <span className="text-xs text-gray-400">{analysisScores.voice}/100</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        analysisScores.voice >= 70 ? 'bg-green-500' : 
                        analysisScores.voice >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analysisScores.voice}%` }}
                    ></div>
                  </div>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScoreColor(analysisScores.voice)}`}>
                    {getScoreLabel(analysisScores.voice)}
                  </div>
                </div>

                {/* Overall Score */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {Math.round((analysisScores.facial + analysisScores.posture + analysisScores.voice) / 3)}%
                    </div>
                    <div className="text-sm text-gray-400">Overall Performance</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Question */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-gray-900/60 border border-gray-700">
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

            {/* Live Transcription Card */}
            <Card className="bg-gray-900/60 border border-gray-700">
              <CardHeader className="border-b border-gray-700">
                <CardTitle className="text-lg font-medium text-gray-100">
                  Live Transcription
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 min-h-[100px]">
                {transcript ? (
                  <p className="text-gray-200">{transcript}</p>
                ) : (
                  <p className="text-gray-500">
                    Your live transcript will appear here as you speak...
                  </p>
                )}
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
        </div>
      </div>
    </div>
  );
};

export default LiveInterview;