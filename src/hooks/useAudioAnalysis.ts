import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioAnalysis {
  volume: number; // 0-1
  isSpeaking: boolean;
  speechRate: number; // Words per minute (approximate)
  pitch: number; // Hz
  clarity: number; // 0-1 (how clear the speech is)
}

interface AudioAnalysisState extends AudioAnalysis {
  isAnalyzing: boolean;
  error: string | null;
}

const useAudioAnalysis = () => {
  const [analysis, setAnalysis] = useState<AudioAnalysisState>({
    volume: 0,
    isSpeaking: false,
    speechRate: 0,
    pitch: 0,
    clarity: 0,
    isAnalyzing: false,
    error: null
  });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speakingStartRef = useRef<number | null>(null);
  const wordCountRef = useRef<number>(0);
  const lastWordTimeRef = useRef<number>(0);
  
  // Initialize audio context and nodes
  const initAudio = useCallback(async (stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.resume();
        return;
      }
      
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      
      // Create script processor for audio analysis
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      // Connect audio nodes
      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      mediaStreamSourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.destination);
      
      return audioContextRef.current;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      setAnalysis(prev => ({
        ...prev,
        error: 'Failed to initialize audio. Please check your microphone permissions.',
        isAnalyzing: false
      }));
      return null;
    }
  }, []);
  
  // Analyze audio data
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Get frequency data
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength) / 255; // Normalize to 0-1
    
    // Simple voice activity detection
    const isSpeaking = rms > 0.05; // Threshold may need adjustment
    
    // Update speaking state and count words
    const now = Date.now();
    if (isSpeaking) {
      if (!speakingStartRef.current) {
        speakingStartRef.current = now;
      }
      
      // Count words based on speech patterns (simplified)
      if (now - lastWordTimeRef.current > 500) { // At least 500ms between words
        wordCountRef.current++;
        lastWordTimeRef.current = now;
      }
    } else if (speakingStartRef.current) {
      // Calculate speech rate (words per minute)
      const speakingDuration = (now - speakingStartRef.current) / 1000 / 60; // in minutes
      const wordsPerMinute = wordCountRef.current / speakingDuration;
      
      // Update analysis
      setAnalysis(prev => ({
        ...prev,
        isSpeaking: false,
        speechRate: Math.min(250, Math.max(0, wordsPerMinute)) // Cap at 250 WPM
      }));
      
      // Reset counters
      speakingStartRef.current = null;
      wordCountRef.current = 0;
    }
    
    // Calculate pitch using autocorrelation (simplified)
    let pitch = 0;
    if (isSpeaking) {
      // This is a simplified pitch detection - in a real app, you'd use a more accurate method
      const correlation = new Float32Array(bufferLength);
      const maxSamples = 1000; // Limit samples for performance
      
      for (let lag = 0; lag < maxSamples; lag++) {
        let sum = 0;
        for (let i = 0; i < maxSamples; i++) {
          sum += (dataArray[i] - 128) * (dataArray[i + lag] - 128);
        }
        correlation[lag] = sum / maxSamples;
      }
      
      // Find the first peak after the first dip
      let maxCorrelation = 0;
      let maxLag = 0;
      
      for (let lag = 1; lag < maxSamples - 1; lag++) {
        if (correlation[lag] > maxCorrelation) {
          maxCorrelation = correlation[lag];
          maxLag = lag;
        }
      }
      
      // Convert lag to frequency
      if (maxLag > 0) {
        pitch = audioContextRef.current?.sampleRate ? 
          audioContextRef.current.sampleRate / maxLag : 0;
      }
    }
    
    // Calculate clarity (harmonicity)
    let clarity = 0;
    if (pitch > 0) {
      // This is a simplified clarity metric
      // In a real app, you'd analyze the harmonic structure of the signal
      clarity = Math.min(1, rms * 2); // Scale volume to 0-1 range
    }
    
    // Update analysis state
    setAnalysis(prev => ({
      ...prev,
      volume: rms,
      isSpeaking,
      pitch,
      clarity,
      isAnalyzing: true,
      error: null
    }));
    
    // Continue analysis loop
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);
  
  // Start audio analysis
  const startAudioAnalysis = useCallback(async (stream?: MediaStream) => {
    try {
      if (analysis.isAnalyzing) return;
      
      setAnalysis(prev => ({ ...prev, isAnalyzing: true, error: null }));
      
      // If no stream is provided, get user media
      let mediaStream = stream;
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      // Initialize audio context and nodes
      const audioContext = await initAudio(mediaStream);
      if (!audioContext) return;
      
      // Start analysis loop
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      
      // Set up script processor
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.onaudioprocess = () => {
          // Analysis happens in the animation frame for better performance
        };
      }
      
    } catch (error) {
      console.error('Error starting audio analysis:', error);
      setAnalysis(prev => ({
        ...prev,
        error: 'Failed to access microphone. Please check your permissions.',
        isAnalyzing: false
      }));
    }
  }, [analysis.isAnalyzing, analyzeAudio, initAudio]);
  
  // Stop audio analysis
  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Disconnect audio nodes
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Reset state
    setAnalysis({
      volume: 0,
      isSpeaking: false,
      speechRate: 0,
      pitch: 0,
      clarity: 0,
      isAnalyzing: false,
      error: null
    });
    
    // Reset refs
    speakingStartRef.current = null;
    wordCountRef.current = 0;
    lastWordTimeRef.current = 0;
  }, []);
  
  // Get current audio analysis
  const getAudioAnalysis = useCallback((): AudioAnalysis => {
    const { isAnalyzing, error, ...audioData } = analysis;
    return audioData;
  }, [analysis]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]);
  
  return {
    ...analysis,
    startAudioAnalysis,
    stopAudioAnalysis,
    getAudioAnalysis
  };
};

export default useAudioAnalysis;
