// Analysis configuration constants
export const ANALYSIS_CONFIG = {
  // Status values
  STATUS: {
    PENDING: 'pending_analysis',
    ANALYZING: 'analyzing',
    COMPLETE: 'analysis_complete',
    FAILED: 'analysis_failed',
  },
  
  // Analysis thresholds
  THRESHOLDS: {
    // Volume (0-1)
    VOLUME: {
      LOW: 0.2,
      HIGH: 0.8,
    },
    // Speech rate (words per minute)
    SPEECH_RATE: {
      SLOW: 100,
      FAST: 200,
    },
    // Pause duration between words (ms)
    PAUSE_DURATION: {
      TOO_LONG: 3000, // 3 seconds
      TOO_SHORT: 300, // 0.3 seconds
    },
  },
  
  // Analysis weights (sum should be 1)
  WEIGHTS: {
    CLARITY: 0.25,
    PACE: 0.2,
    VOLUME: 0.15,
    PAUSE: 0.15,
    FILLER_WORDS: 0.1,
    EYE_CONTACT: 0.1,
    POSTURE: 0.05,
  },
  
  // API endpoints
  ENDPOINTS: {
    START_ANALYSIS: '/api/analysis/start',
    GET_ANALYSIS_STATUS: (sessionId: string) => `/api/analysis/status/${sessionId}`,
  },
  
  // Polling intervals (ms)
  POLLING: {
    INITIAL_DELAY: 2000, // 2 seconds before first poll
    INTERVAL: 5000, // 5 seconds between polls
    TIMEOUT: 300000, // 5 minutes total timeout
  },
  
  // Error messages
  MESSAGES: {
    ANALYSIS_STARTED: 'Analysis started successfully',
    ANALYSIS_IN_PROGRESS: 'Analysis in progress',
    ANALYSIS_COMPLETE: 'Analysis complete',
    ANALYSIS_FAILED: 'Analysis failed',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    UNKNOWN_ERROR: 'An unknown error occurred',
  },
} as const;

// Feedback messages for different analysis aspects
export const FEEDBACK_MESSAGES = {
  VOLUME: {
    TOO_LOW: 'Speak louder, your voice is too quiet',
    TOO_HIGH: 'Your volume is too high, try to speak more softly',
    GOOD: 'Your volume is at a good level',
  },
  PACE: {
    TOO_SLOW: 'Try to speak a bit faster',
    TOO_FAST: 'Slow down your speech for better clarity',
    GOOD: 'Your speaking pace is good',
  },
  CLARITY: {
    POOR: 'Try to enunciate your words more clearly',
    GOOD: 'Your speech is clear and easy to understand',
  },
  PAUSE: {
    TOO_LONG: 'Try to reduce long pauses in your speech',
    TOO_SHORT: 'Add more pauses between your thoughts',
    GOOD: 'Your use of pauses is effective',
  },
  FILLER_WORDS: {
    TOO_MANY: 'Try to reduce filler words (um, uh, like)',
    GOOD: 'Good job minimizing filler words',
  },
} as const;

// Default analysis results
export const DEFAULT_ANALYSIS = {
  analysis: 'No analysis available yet',
  strengths: [] as string[],
  areas_for_improvement: [] as string[],
  overall_score: 0,
} as const;
