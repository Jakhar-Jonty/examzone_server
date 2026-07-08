import mongoose from 'mongoose';

// const examAttemptSchema = new mongoose.Schema({
//   user: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
//   exam: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Exam', 
//     required: true 
//   },
//   answers: [{
//     question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
//     selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D', null] },
//     isCorrect: { type: Boolean },
//     marksObtained: { type: Number, default: 0 },
//     timeSpent: { type: Number, default: 0 } // Time spent on this question in seconds
//   }],
//   startTime: { type: Date, required: true },
//   endTime: { type: Date },
//   timeTaken: { type: Number },
//   totalScore: { type: Number, default: 0 },
//   correctAnswers: { type: Number, default: 0 },
//   incorrectAnswers: { type: Number, default: 0 },
//   unattempted: { type: Number, default: 0 },
//   percentage: { type: Number, default: 0 },
//   isCompleted: { type: Boolean, default: false },
//   isPaused: { type: Boolean, default: false },
//   pausedAt: { type: Date },
//   pausedDuration: { type: Number, default: 0 }, // Total paused time in seconds
//   lastResumedAt: { type: Date },
//   attemptNumber: { type: Number, required: true, default: 1 },
//   createdAt: { type: Date, default: Date.now }
// });


// ==========================================
// 2. ENHANCED EXAM ATTEMPT SCHEMA
// ==========================================
const examAttemptSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  exam: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exam', 
    required: true,
    index: true
  },
  
  // Attempt Metadata
  attemptNumber: { type: Number, required: true, default: 1 },
  attemptType: {
    type: String,
    enum: ['full', 'practice', 'review', 'adaptive', 'weak-areas'],
    default: 'full'
  },
  
  // Detailed Answer Tracking
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    section: { type: String }, // Section name if exam has sections
    sectionIndex: { type: Number },
    
    // Answer Details
    selectedAnswer: { type: String }, // Can be null for unattempted
    selectedAnswers: [{ type: String }], // For multiple correct type
    isCorrect: { type: Boolean },
    isPartiallyCorrect: { type: Boolean, default: false }, // For multiple correct
    
    // Scoring
    marksAwarded: { type: Number, default: 0 },
    marksDeducted: { type: Number, default: 0 },
    netMarks: { type: Number, default: 0 },
    
    // Time Tracking
    timeSpent: { type: Number, default: 0 }, // seconds
    viewCount: { type: Number, default: 1 }, // How many times viewed this question
    
    // Flags & Actions
    isMarkedForReview: { type: Boolean, default: false },
    isSkipped: { type: Boolean, default: false },
    answerChangedCount: { type: Number, default: 0 },
    
    // First vs Final Answer (for analytics)
    firstAnswer: { type: String },
    finalAnswer: { type: String },
    
    // Question Metadata at attempt time (for historical accuracy)
    difficulty: { type: String },
    subject: { type: String },
    topic: { type: String },
    questionType: { type: String }
  }],
  
  // Section-wise Performance
  sectionPerformance: [{
    sectionName: { type: String, required: true },
    sectionIndex: { type: Number },
    totalQuestions: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    markedForReview: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }, // seconds
    cutoffMet: { type: Boolean }
  }],
  
  // Subject-wise Performance
  subjectPerformance: [{
    subject: { type: String, required: true },
    totalQuestions: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }
  }],
  
  // Difficulty-wise Performance
  difficultyPerformance: {
    easy: {
      total: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    medium: {
      total: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    hard: {
      total: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  
  // Time Tracking
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  timeTaken: { type: Number }, // Total time in seconds
  timeRemaining: { type: Number }, // Remaining time when submitted
  
  // Pause/Resume Tracking
  isPaused: { type: Boolean, default: false },
  pausedAt: { type: Date },
  pausedDuration: { type: Number, default: 0 },
  pauseCount: { type: Number, default: 0 },
  lastResumedAt: { type: Date },
  
  // Tab Switch Detection (for proctoring)
  tabSwitches: { type: Number, default: 0 },
  tabSwitchTimestamps: [{ type: Date }],
  
  // Overall Performance
  totalQuestions: { type: Number, required: true },
  totalScore: { type: Number, default: 0 },
  maxScore: { type: Number, required: true },
  correctAnswers: { type: Number, default: 0 },
  incorrectAnswers: { type: Number, default: 0 },
  unattempted: { type: Number, default: 0 },
  markedForReview: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  
  // Negative Marking
  negativeMarks: { type: Number, default: 0 },
  
  // Status
  isCompleted: { type: Boolean, default: false },
  submittedAt: { type: Date },
  submissionType: {
    type: String,
    enum: ['manual', 'auto-time', 'auto-tab-switch'],
    default: 'manual'
  },
  
  // Ranking (calculated after attempt)
  rank: { type: Number },
  totalParticipants: { type: Number },
  percentile: { type: Number },
  
  // Comparison with Previous Attempts
  improvementFromLastAttempt: { type: Number }, // Percentage points
  
  // AI Insights (generated post-attempt)
  insights: {
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    recommendations: [{ type: String }],
    estimatedPreparationLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    generatedAt: { type: Date }
  },
  
  // Review Status
  isReviewed: { type: Boolean, default: false },
  reviewedAt: { type: Date },
  
  // Device & Location Info
  device: {
    type: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    os: { type: String },
    browser: { type: String }
  },
  ipAddress: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
examAttemptSchema.index({ user: 1, exam: 1, attemptNumber: 1 });
examAttemptSchema.index({ user: 1, createdAt: -1 });
examAttemptSchema.index({ exam: 1, isCompleted: 1 });
examAttemptSchema.index({ totalScore: -1, exam: 1 }); // For leaderboard
examAttemptSchema.index({ percentage: -1 });

export default mongoose.model('ExamAttempt', examAttemptSchema);

