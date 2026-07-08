import mongoose from "mongoose";

const userAnalyticsSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  
  // Overall Performance
  overallStats: {
    totalTestsTaken: { type: Number, default: 0 },
    totalQuestionsAttempted: { type: Number, default: 0 },
    totalQuestionsCorrect: { type: Number, default: 0 },
    overallAccuracy: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageTimePerQuestion: { type: Number, default: 0 }, // seconds
    totalStudyTime: { type: Number, default: 0 }, // hours
    lastTestDate: { type: Date }
  },
  
  // Subject-wise Performance
  subjectWiseStats: [{
    subject: { type: String, required: true },
    questionsAttempted: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }, // minutes
    strength: { type: String, enum: ['weak', 'average', 'strong'], default: 'average' },
    lastPracticed: { type: Date }
  }],
  
  // Topic-wise Performance
  topicWiseStats: [{
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    questionsAttempted: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    masteryLevel: { type: Number, min: 0, max: 100, default: 0 },
    needsPractice: { type: Boolean, default: false },
    lastPracticed: { type: Date }
  }],
  
  // Difficulty-wise Performance
  difficultyStats: {
    easy: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    medium: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    },
    hard: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  
  // Question Type Performance
  questionTypeStats: [{
    type: { type: String, required: true },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 }
  }],
  
  // Weak Areas (AI-identified)
  weakAreas: [{
    type: { type: String, enum: ['subject', 'topic', 'concept', 'question-type'] },
    name: { type: String, required: true },
    accuracy: { type: Number },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    recommendedQuestions: { type: Number, default: 10 },
    identifiedAt: { type: Date, default: Date.now }
  }],
  
  // Strong Areas
  strongAreas: [{
    type: { type: String, enum: ['subject', 'topic', 'concept'] },
    name: { type: String, required: true },
    accuracy: { type: Number },
    masteryLevel: { type: Number }
  }],
  
  // Learning Patterns
  learningPatterns: {
    preferredTimeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] },
    averageSessionDuration: { type: Number }, // minutes
    questionsPerSession: { type: Number },
    peakPerformanceTime: { type: String },
    consistencyScore: { type: Number, min: 0, max: 100 } // Based on study regularity
  },
  
  // Progress Trends (last 30 days)
  progressTrends: {
    accuracyTrend: { type: String, enum: ['improving', 'declining', 'stable'] },
    scoreTrend: { type: String, enum: ['improving', 'declining', 'stable'] },
    speedTrend: { type: String, enum: ['improving', 'declining', 'stable'] },
    last30DaysAccuracy: [{ type: Number }], // Daily accuracy
    last30DaysScore: [{ type: Number }] // Daily average score
  },
  
  // Comparison with Peers
  peerComparison: {
    rank: { type: Number },
    totalUsers: { type: Number },
    percentile: { type: Number },
    betterThan: { type: Number }, // Percentage of users
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }
  },
  
  // Predictions (AI-generated)
  predictions: {
    estimatedExamScore: { type: Number },
    estimatedRank: { type: Number },
    readinessLevel: { type: String, enum: ['Not Ready', 'Needs Work', 'Almost Ready', 'Ready', 'Well Prepared'] },
    confidence: { type: Number, min: 0, max: 100 },
    generatedAt: { type: Date }
  },
  
  // Last Updated
  lastCalculatedAt: { type: Date, default: Date.now },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

userAnalyticsSchema.index({ user: 1 });
userAnalyticsSchema.index({ 'weakAreas.priority': 1 });


export default mongoose.model("UserAnalytics", userAnalyticsSchema);
