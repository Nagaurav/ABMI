import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceDetection, FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { Pose, POSE_CONNECTIONS, POSE_LANDMARKS } from '@mediapipe/pose';

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
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceLandmarks, setFaceLandmarks] = useState<any[]>([]);
  const [poseLandmarks, setPoseLandmarks] = useState<any[]>([]);
  const [faceMeshDetector, setFaceMeshDetector] = useState<FaceLandmarker | null>(null);
  const [poseDetector, setPoseDetector] = useState<Pose | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  
  // Initialize face mesh detector
  const initializeFaceMesh = useCallback(async () => {
    try {
      const faceMesh = new FaceLandmarker({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        }
      });
      
      await faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      setFaceMeshDetector(faceMesh);
      return faceMesh;
    } catch (error) {
      console.error('Error initializing face mesh:', error);
      throw error;
    }
  }, []);
  
  // Initialize pose detector
  const initializePose = useCallback(async () => {
    try {
      const pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
        }
      });
      
      await pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      setPoseDetector(pose);
      return pose;
    } catch (error) {
      console.error('Error initializing pose detection:', error);
      throw error;
    }
  }, []);
  
  // Analyze face landmarks
  const analyzeFace = useCallback(async (): Promise<FaceAnalysis> => {
    if (!faceMeshDetector || !webcamRef.current) {
      return { isDetected: false };
    }
    
    try {
      const results = await faceMeshDetector.detectForVideo(webcamRef.current, Date.now());
      
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        setFaceLandmarks(landmarks);
        
        // Simple expression detection (smile, eye contact, head tilt)
        const leftEye = landmarks[33]; // Left eye inner corner
        const rightEye = landmarks[263]; // Right eye inner corner
        const noseTip = landmarks[1]; // Nose tip
        const leftMouth = landmarks[61]; // Left mouth corner
        const rightMouth = landmarks[291]; // Right mouth corner
        
        // Calculate smile (distance between mouth corners)
        const smileDistance = Math.sqrt(
          Math.pow(rightMouth.x - leftMouth.x, 2) + 
          Math.pow(rightMouth.y - leftMouth.y, 2)
        );
        
        // Simple head tilt calculation (angle between eyes and nose)
        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const angle = Math.atan2(
          noseTip.y - eyeCenterY,
          noseTip.x - eyeCenterX
        ) * (180 / Math.PI);
        
        return {
          isDetected: true,
          landmarks,
          expressions: {
            smile: Math.min(1, Math.max(0, (smileDistance - 0.1) * 5)), // Normalize to 0-1
            eyeContact: true, // Simplified - in a real app, you'd check if eyes are looking at camera
            headTilt: {
              x: Math.sin(angle * Math.PI / 180),
              y: Math.cos(angle * Math.PI / 180),
              z: 0
            }
          }
        };
      }
      
      return { isDetected: false };
    } catch (error) {
      console.error('Error analyzing face:', error);
      return { isDetected: false };
    }
  }, [faceMeshDetector, webcamRef]);
  
  // Analyze pose
  const analyzePose = useCallback(async (): Promise<PoseAnalysis> => {
    if (!poseDetector || !webcamRef.current) {
      return { isDetected: false };
    }
    
    try {
      const results = await poseDetector.detectForVideo(webcamRef.current, Date.now());
      
      if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        setPoseLandmarks(landmarks);
        
        // Simple posture analysis
        const leftShoulder = landmarks[11]; // Left shoulder
        const rightShoulder = landmarks[12]; // Right shoulder
        const leftHip = landmarks[23]; // Left hip
        const rightHip = landmarks[24]; // Right hip
        const leftWrist = landmarks[15]; // Left wrist
        const rightWrist = landmarks[16]; // Right wrist
        
        // Check shoulder alignment
        const shoulderSlope = (rightShoulder.y - leftShoulder.y) / (rightShoulder.x - leftShoulder.x);
        const shoulderAlignment = Math.abs(shoulderSlope) < 0.2 ? 'aligned' : 
                                shoulderSlope > 0 ? 'leaning_left' : 'leaning_right';
        
        // Check if back is straight (simplified)
        const leftTorsoAngle = Math.atan2(
          leftHip.y - leftShoulder.y,
          leftHip.x - leftShoulder.x
        ) * (180 / Math.PI);
        
        const rightTorsoAngle = Math.atan2(
          rightHip.y - rightShoulder.y,
          rightHip.x - rightShoulder.x
        ) * (180 / Math.PI);
        
        const isHunched = Math.abs(leftTorsoAngle) > 100 || Math.abs(rightTorsoAngle) > 100;
        
        // Check if hands are visible
        const handsVisible = (leftWrist.visibility > 0.5 || rightWrist.visibility > 0.5) ? 'visible' : 'hidden';
        
        return {
          isDetected: true,
          landmarks,
          posture: {
            shoulders: shoulderAlignment === 'aligned' ? 'aligned' : 'leaning',
            back: isHunched ? 'hunched' : 'straight',
            hands: handsVisible
          }
        };
      }
      
      return { isDetected: false };
    } catch (error) {
      console.error('Error analyzing pose:', error);
      return { isDetected: false };
    }
  }, [poseDetector, webcamRef]);
  
  // Start detection
  const startDetection = useCallback(async () => {
    if (!webcamRef.current) return;
    
    try {
      // Initialize models if needed
      const faceMesh = faceMeshDetector || await initializeFaceMesh();
      const pose = poseDetector || await initializePose();
      
      // Set up camera
      const camera = new Camera(webcamRef.current, {
        onFrame: async () => {
          if (faceMesh && webcamRef.current) {
            await faceMesh.send({ image: webcamRef.current });
          }
          
          if (pose && webcamRef.current) {
            await pose.send({ image: webcamRef.current });
          }
        },
        width: 640,
        height: 480
      });
      
      await camera.start();
      setCamera(camera);
      setIsModelLoading(false);
      
      return () => {
        camera.stop();
      };
    } catch (error) {
      console.error('Error starting detection:', error);
      setIsModelLoading(false);
      throw error;
    }
  }, [faceMeshDetector, initializeFaceMesh, initializePose, poseDetector, webcamRef]);
  
  // Stop detection
  const stopDetection = useCallback(() => {
    if (camera) {
      camera.stop();
      setCamera(null);
    }
    
    setFaceLandmarks([]);
    setPoseLandmarks([]);
  }, [camera]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      
      if (faceMeshDetector) {
        faceMeshDetector.close();
      }
      
      if (poseDetector) {
        poseDetector.close();
      }
    };
  }, [faceMeshDetector, poseDetector, stopDetection]);
  
  return {
    isModelLoading,
    faceLandmarks,
    poseLandmarks,
    faceMeshDetector,
    poseDetector,
    startDetection,
    stopDetection,
    analyzeFace,
    analyzePose
  };
};

export default useMediaPipe;
