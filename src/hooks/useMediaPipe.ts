import { useCallback, useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

interface FaceAnalysis {
  isDetected: boolean;
  landmarks?: any[];
  expressions?: {
    smile: number;
    eyeContact: boolean;
    headTilt: { x: number; y: number; z: number };
  };
}

interface PoseAnalysis {
  isDetected: boolean;
  landmarks?: any[];
  posture?: {
    shoulders: 'aligned' | 'slouching' | 'leaning';
    back: 'straight' | 'hunched';
    hands: 'visible' | 'hidden';
  };
}

const useMediaPipe = (webcamRef: React.RefObject<HTMLVideoElement>) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceLandmarks, setFaceLandmarks] = useState<any[]>([]);
  const [poseLandmarks, setPoseLandmarks] = useState<any[]>([]);
  
  const poseDetectorRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Initialize TensorFlow.js and models
  useEffect(() => {
    const initializeTensorFlow = async () => {
      try {
        console.log('🔄 Initializing TensorFlow.js...');
        console.log('🌐 Browser:', navigator.userAgent.includes('Edg') ? 'Microsoft Edge' : 'Other');
        
        // Set backend explicitly for Edge compatibility
        if (navigator.userAgent.includes('Edg')) {
          console.log('🔧 Configuring for Microsoft Edge...');
          await tf.setBackend('cpu'); // Use CPU backend for Edge
        } else {
          try {
            await tf.setBackend('webgl'); // Try WebGL first
          } catch {
            console.log('⚠️ WebGL not available, falling back to CPU');
            await tf.setBackend('cpu');
          }
        }
        
        // Initialize TensorFlow.js
        await tf.ready();
        console.log('✅ TensorFlow.js ready with backend:', tf.getBackend());
        
        // Load pose detection model with Edge-compatible settings
        const poseDetection = await import('@tensorflow-models/pose-detection');
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: false, // Disable for better Edge compatibility
            multiPoseMaxDimension: 256 // Lower resolution for better performance
          }
        );
        
        poseDetectorRef.current = detector;
        console.log('✅ Pose detection model loaded for', navigator.userAgent.includes('Edg') ? 'Edge' : 'browser');
        
        setIsModelLoading(false);
      } catch (error) {
        console.error('❌ Failed to initialize TensorFlow.js:', error);
        console.log('🔄 Trying fallback initialization...');
        
        // Fallback: Try with minimal settings
        try {
          await tf.setBackend('cpu');
          await tf.ready();
          console.log('✅ TensorFlow.js ready with CPU fallback');
          setIsModelLoading(false);
        } catch (fallbackError) {
          console.error('❌ Complete TensorFlow.js initialization failed:', fallbackError);
          setIsModelLoading(false);
        }
      }
    };
    
    initializeTensorFlow();
  }, []);
  // Analyze pose using TensorFlow.js with Edge optimizations
  const runPoseDetection = useCallback(async () => {
    if (!webcamRef.current || !poseDetectorRef.current || !isAnalyzing) return;
    
    try {
      // Add delay for Edge performance
      const isEdge = navigator.userAgent.includes('Edg');
      if (isEdge) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay for Edge
      }
      
      const poses = await poseDetectorRef.current.estimatePoses(webcamRef.current, {
        maxPoses: 1,
        flipHorizontal: false,
        scoreThreshold: 0.3 // Lower threshold for better detection
      });
      
      if (poses && poses.length > 0) {
        const pose = poses[0];
        setPoseLandmarks(pose.keypoints);
        
        // Less frequent logging for Edge
        if (!isEdge || Math.random() < 0.1) {
          console.log('🧍 Pose detected:', pose.keypoints.length, 'keypoints');
        }
      } else {
        setPoseLandmarks([]);
      }
    } catch (error) {
      console.error('❌ Error in pose detection:', error);
      // Don't spam errors in Edge
      if (!navigator.userAgent.includes('Edg')) {
        console.error('Full error:', error);
      }
    }
    
    // Continue detection loop with appropriate timing
    if (isAnalyzing) {
      const delay = navigator.userAgent.includes('Edg') ? 200 : 100; // Slower for Edge
      setTimeout(() => {
        if (isAnalyzing) {
          animationFrameRef.current = requestAnimationFrame(runPoseDetection);
        }
      }, delay);
    }
  }, [webcamRef, isAnalyzing]);
  
  // Analyze face landmarks (simplified for now - face detection not implemented)
  const analyzeFace = useCallback(async (): Promise<FaceAnalysis> => {
    // For now, return basic face analysis
    // TODO: Implement face detection with TensorFlow.js face-landmarks-detection
    return {
      isDetected: false, // No face detection implemented yet
      expressions: {
        smile: 0.5,
        eyeContact: true,
        headTilt: { x: 0, y: 0, z: 0 }
      }
    };
  }, []);
  
  // Analyze pose landmarks using TensorFlow.js keypoints
  const analyzePose = useCallback(async (): Promise<PoseAnalysis> => {
    if (!poseLandmarks || poseLandmarks.length === 0) {
      return { isDetected: false };
    }
    
    try {
      // TensorFlow.js MoveNet keypoints (different indices than MediaPipe)
      const leftShoulder = poseLandmarks.find((kp: any) => kp.name === 'left_shoulder');
      const rightShoulder = poseLandmarks.find((kp: any) => kp.name === 'right_shoulder');
      const leftHip = poseLandmarks.find((kp: any) => kp.name === 'left_hip');
      const rightHip = poseLandmarks.find((kp: any) => kp.name === 'right_hip');
      const leftWrist = poseLandmarks.find((kp: any) => kp.name === 'left_wrist');
      const rightWrist = poseLandmarks.find((kp: any) => kp.name === 'right_wrist');
      
      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        return { isDetected: false };
      }
      
      // Shoulder alignment analysis
      const shoulderSlope = Math.abs(rightShoulder.y - leftShoulder.y);
      let shoulderAlignment: 'aligned' | 'slouching' | 'leaning' = 'aligned';
      
      if (shoulderSlope > 20) { // Adjusted threshold for pixel coordinates
        shoulderAlignment = 'leaning';
      }
      
      // Back posture analysis (using shoulder to hip angle)
      const leftTorsoAngle = Math.atan2(
        leftHip.y - leftShoulder.y,
        leftHip.x - leftShoulder.x
      ) * (180 / Math.PI);
      
      const rightTorsoAngle = Math.atan2(
        rightHip.y - rightShoulder.y,
        rightHip.x - rightShoulder.x
      ) * (180 / Math.PI);
      
      const avgTorsoAngle = (Math.abs(leftTorsoAngle) + Math.abs(rightTorsoAngle)) / 2;
      const backPosture: 'straight' | 'hunched' = avgTorsoAngle > 100 ? 'hunched' : 'straight';
      
      // Hand visibility (check if wrists are detected with good confidence)
      const leftWristVisible = leftWrist && leftWrist.score > 0.3;
      const rightWristVisible = rightWrist && rightWrist.score > 0.3;
      const handsVisible: 'visible' | 'hidden' = (leftWristVisible || rightWristVisible) ? 'visible' : 'hidden';
      
      console.log('🧍 Pose analysis:', { shoulderAlignment, backPosture, handsVisible });
      
      return {
        isDetected: true,
        landmarks: poseLandmarks,
        posture: {
          shoulders: shoulderAlignment,
          back: backPosture,
          hands: handsVisible
        }
      };
    } catch (error) {
      console.error('Error analyzing pose:', error);
      return { isDetected: false };
    }
  }, [poseLandmarks]);
  
  // Start detection
  const startDetection = useCallback(async () => {
    if (!webcamRef.current || isAnalyzing || !poseDetectorRef.current) return;
    
    try {
      setIsAnalyzing(true);
      console.log('🎥 Starting TensorFlow.js pose detection...');
      
      // Start the pose detection loop
      runPoseDetection();
      
    } catch (error) {
      console.error('❌ Error starting detection:', error);
      setIsAnalyzing(false);
    }
  }, [webcamRef, isAnalyzing, runPoseDetection]);
  
  // Stop detection
  const stopDetection = useCallback(() => {
    setIsAnalyzing(false);
    
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setFaceLandmarks([]);
    setPoseLandmarks([]);
    console.log('🛑 TensorFlow.js analysis stopped');
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);
  
  return {
    isModelLoading,
    faceLandmarks,
    poseLandmarks,
    startDetection,
    stopDetection,
    analyzeFace,
    analyzePose
  };
};

export default useMediaPipe;
