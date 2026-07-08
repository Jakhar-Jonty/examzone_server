// ==========================================
// ENHANCED SCHEMAS FOR GOVT EXAM PREP APP
// ==========================================

import mongoose from 'mongoose';

// ==========================================
// 1. ENHANCED USER SCHEMA
// ==========================================
const userSchema = new mongoose.Schema({
  // Basic Info
  phoneNumber: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    index: true
  },
  password: { type: String },
  
  // Profile
  profileImage: { type: String },
  dateOfBirth: { type: Date },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other', 'prefer-not-to-say'] 
  },
  state: { type: String },
  city: { type: String },
  bio: { type: String, maxlength: 500 },
  
  // Exam Preparation
  examPreparations: [{ 
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    tier: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
    targetExamDate: { type: Date },
    isPrimary: { type: Boolean, default: false }
  }],
  
  preferredLanguage: { 
    type: String, 
    enum: ['Hindi', 'English', 'Both'], 
    default: 'English' 
  },
  
  // User Preferences & Settings
  preferences: {
    notificationsEnabled: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: true },
    
    // Study Preferences
    dailyStudyGoal: { type: Number, default: 60 }, // minutes
    preferredStudyTime: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] },
    difficultyPreference: { type: String, enum: ['adaptive', 'easy', 'medium', 'hard'], default: 'adaptive' },
    
    // Test Preferences
    showAnswersDuringTest: { type: Boolean, default: false },
    showExplanationsAfterTest: { type: Boolean, default: true },
    enableTimer: { type: Boolean, default: true },
    enableNegativeMarking: { type: Boolean, default: true },
    
    // UI Preferences
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
  },
  
  // Subscription
  role: { 
    type: String, 
    enum: ['user', 'admin', 'moderator'], 
    default: 'user' 
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'premium', 'trial'],
    default: 'free'
  },
  subscriptionExpiry: { type: Date },
  trialUsed: { type: Boolean, default: false },
  
  // Streaks & Gamification
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastStudyDate: { type: Date },
  totalStudyDays: { type: Number, default: 0 },
  totalStudyHours: { type: Number, default: 0 },
  
  // XP & Levels
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  rank: { type: String, enum: ['Beginner', 'Learner', 'Skilled', 'Expert', 'Master'], default: 'Beginner' },
  
  // Badges (kept for backward compatibility, but separate Badge collection recommended)
  badges: [{
    badgeId: { type: String, required: true },
    badgeName: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now }
  }],
  
  // Performance Summary (cached for quick access)
  performanceSummary: {
    totalTestsTaken: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageAccuracy: { type: Number, default: 0 },
    totalQuestionsAttempted: { type: Number, default: 0 },
    totalQuestionsCorrect: { type: Number, default: 0 },
    strongSubjects: [{ type: String }],
    weakSubjects: [{ type: String }],
    lastUpdated: { type: Date }
  },
  
  // Weekly limits (for free users)
  weeklyExamsAttempted: { type: Number, default: 0 },
  lastWeekReset: { type: Date, default: Date.now },
  
  // Account Status
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  bannedUntil: { type: Date },
  
  // Referral System
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCount: { type: Number, default: 0 },
  
  // Last Activity
  lastLoginAt: { type: Date },
  lastActiveAt: { type: Date },
  loginCount: { type: Number, default: 0 },
  
  // Device Info (for analytics)
  devices: [{
    deviceId: { type: String },
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    os: { type: String },
    lastUsed: { type: Date }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ 'examPreparations.category': 1 });
userSchema.index({ subscriptionStatus: 1, subscriptionExpiry: 1 });
userSchema.index({ currentStreak: -1 });
userSchema.index({ xp: -1 });

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

// ==========================================
// 3. NEW: TEST SERIES SCHEMA
// ==========================================
const testSeriesSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  thumbnail: { type: String },
  
  // Categorization
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    required: true 
  },
  subCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category'
  },
  tier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tier'
  },
  
  // Series Details
  seriesType: {
    type: String,
    enum: ['mock', 'practice', 'sectional', 'pyq', 'topic-wise', 'full-length'],
    default: 'mock'
  },
  
  // Exams in Series
  exams: [{
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    order: { type: Number, required: true },
    isLocked: { type: Boolean, default: false },
    unlockCondition: {
      type: { type: String, enum: ['none', 'previous-completion', 'minimum-score', 'date'] },
      value: { type: mongoose.Schema.Mixed } // Score threshold or date
    },
    scheduledDate: { type: Date } // When this exam becomes available
  }],
  
  // Pricing
  isPremium: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  discountPrice: { type: Number },
  
  // Validity
  validityDays: { type: Number }, // How many days access after purchase/enrollment
  startDate: { type: Date },
  endDate: { type: Date },
  
  // Enrollment
  enrollmentType: {
    type: String,
    enum: ['free', 'paid', 'invite-only'],
    default: 'free'
  },
  maxEnrollments: { type: Number }, // Limit enrollments
  currentEnrollments: { type: Number, default: 0 },
  
  // Statistics
  totalTests: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  estimatedDuration: { type: Number }, // Total hours
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: { type: Date },
  
  // Tags & SEO
  tags: [{ type: String }],
  keywords: [{ type: String }],
  
  // Features
  features: [{
    type: String,
    // e.g., 'Video Solutions', 'Live Leaderboard', 'PDF Report'
  }],
  
  // Analytics
  views: { type: Number, default: 0 },
  enrollments: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

testSeriesSchema.index({ category: 1, status: 1 });
testSeriesSchema.index({ isPremium: 1 });
testSeriesSchema.index({ publishedAt: -1 });

// ==========================================
// 4. NEW: TEST SERIES ENROLLMENT SCHEMA
// ==========================================
const testSeriesEnrollmentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  testSeries: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TestSeries', 
    required: true 
  },
  
  // Enrollment Details
  enrolledAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  
  // Payment (if paid series)
  isPaid: { type: Boolean, default: false },
  amountPaid: { type: Number, default: 0 },
  paymentId: { type: String },
  transactionDate: { type: Date },
  
  // Progress Tracking
  testsCompleted: { type: Number, default: 0 },
  testsAttempted: { type: Number, default: 0 },
  totalTests: { type: Number, required: true },
  progressPercentage: { type: Number, default: 0 },
  
  currentTest: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  
  // Performance Summary
  averageScore: { type: Number, default: 0 },
  averageAccuracy: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  worstScore: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'cancelled'],
    default: 'active'
  },
  completedAt: { type: Date },
  
  // Certification (if applicable)
  certificateIssued: { type: Boolean, default: false },
  certificateUrl: { type: String },
  certificateIssuedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

testSeriesEnrollmentSchema.index({ user: 1, testSeries: 1 }, { unique: true });
testSeriesEnrollmentSchema.index({ user: 1, status: 1 });

// ==========================================
// 5. NEW: LEADERBOARD SCHEMA
// ==========================================
const leaderboardSchema = new mongoose.Schema({
  // Leaderboard Type
  type: {
    type: String,
    enum: ['exam', 'test-series', 'weekly', 'monthly', 'all-time', 'category'],
    required: true
  },
  
  // Reference (exam or test series)
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  testSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  
  // Time Period (for weekly/monthly)
  startDate: { type: Date },
  endDate: { type: Date },
  
  // Entries
  entries: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rank: { type: Number, required: true },
    score: { type: Number, required: true },
    accuracy: { type: Number },
    timeTaken: { type: Number }, // seconds
    percentile: { type: Number },
    attempts: { type: Number, default: 1 },
    lastAttemptAt: { type: Date },
    
    // Badges for this leaderboard
    badges: [{
      type: String,
      // e.g., 'Top 10', 'Perfect Score', 'Speed Master'
    }]
  }],
  
  // Statistics
  totalParticipants: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  highestScore: { type: Number, default: 0 },
  lowestScore: { type: Number, default: 0 },
  
  // Status
  isLive: { type: Boolean, default: true },
  lastUpdatedAt: { type: Date, default: Date.now },
  
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

leaderboardSchema.index({ type: 1, exam: 1 });
leaderboardSchema.index({ type: 1, testSeries: 1 });
leaderboardSchema.index({ 'entries.user': 1 });
leaderboardSchema.index({ 'entries.rank': 1 });

// ==========================================
// 6. NEW: USER ANALYTICS SCHEMA
// ==========================================
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

// ==========================================
// 7. NEW: NOTIFICATION SCHEMA
// ==========================================
const notificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Notification Content
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Type & Category
  type: {
    type: String,
    enum: [
      'exam-reminder', 
      'test-series-update', 
      'streak-reminder',
      'achievement',
      'rank-update',
      'new-content',
      'subscription',
      'system',
      'promotional'
    ],
    required: true
  },
  
  category: {
    type: String,
    enum: ['exam', 'achievement', 'reminder', 'update', 'alert', 'marketing'],
    default: 'update'
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Reference Objects
  relatedExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  relatedTestSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  relatedBadge: { type: String },
  
  // Action
  actionUrl: { type: String }, // Deep link or URL
  actionText: { type: String }, // Button text like "Start Exam", "View Results"
  
  // Icon & Styling
  icon: { type: String },
  iconColor: { type: String },
  image: { type: String },
  
  // Status
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  
  // Delivery
  deliveryChannel: {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  
  // Scheduling
  scheduledFor: { type: Date }, // For scheduled notifications
  
  // Grouping (to prevent spam)
  groupKey: { type: String }, // Group similar notifications
  
  // Expiry
  expiresAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });

// ==========================================
// 8. NEW: BADGE/ACHIEVEMENT SCHEMA
// ==========================================
const badgeSchema = new mongoose.Schema({
  badgeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  
  // Visual
  icon: { type: String, required: true },
  color: { type: String, default: '#FFD700' },
  image: { type: String },
  
  // Category
  category: {
    type: String,
    enum: [
      'streak', 
      'test-completion', 
      'score', 
      'accuracy', 
      'speed',
      'mastery',
      'special',
      'seasonal'
    ],
    required: true
  },
  
  // Criteria (condition to earn)
  criteria: {
    type: { 
      type: String, 
      enum: [
        'streak-days',
        'tests-completed',
        'score-threshold',
        'accuracy-threshold',
        'perfect-score',
        'speed-master',
        'subject-mastery',
        'rank-achievement',
        'custom'
      ],
      required: true
    },
    value: { type: mongoose.Schema.Mixed, required: true }, // Threshold value
    description: { type: String }
  },
  
  // Rarity
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  
  // Rewards (XP, etc.)
  rewards: {
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 0 } // If you add a coin system
  },
  
  // Statistics
  totalAwarded: { type: Number, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true },
  isHidden: { type: Boolean, default: false }, // Secret badges
  
  createdAt: { type: Date, default: Date.now }
});

badgeSchema.index({ badgeId: 1 });
badgeSchema.index({ category: 1, isActive: 1 });

// ==========================================
// 9. NEW: USER BADGE SCHEMA (Junction Table)
// ==========================================
const userBadgeSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  badge: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Badge', 
    required: true 
  },
  
  // When & How Earned
  earnedAt: { type: Date, default: Date.now },
  earnedFrom: {
    type: { type: String, enum: ['exam', 'streak', 'achievement', 'manual'] },
    referenceId: { type: mongoose.Schema.Types.ObjectId }
  },
  
  // Progress (if badge has levels)
  currentLevel: { type: Number, default: 1 },
  progress: { type: Number, default: 0 }, // Percentage to next level
  
  // Display
  isDisplayed: { type: Boolean, default: false }, // Show on profile
  displayOrder: { type: Number, default: 0 }
}, {
  timestamps: false
});

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
userBadgeSchema.index({ user: 1, earnedAt: -1 });

// ==========================================
// 10. NEW: STUDY PLAN SCHEMA
// ==========================================
const studyPlanSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Plan Details
  title: { type: String, required: true },
  description: { type: String },
  
  // Target
  targetExam: {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    tier: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
    examDate: { type: Date }
  },
  
  // Duration
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  durationWeeks: { type: Number },
  
  // Daily Schedule
  dailySchedule: {
    studyHoursPerDay: { type: Number, default: 4 },
    preferredTimeSlots: [{
      startTime: { type: String }, // HH:mm format
      endTime: { type: String },
      activity: { type: String, enum: ['study', 'practice', 'test', 'revision'] }
    }],
    restDays: [{ type: Number }] // 0-6 (Sunday-Saturday)
  },
  
  // Subjects & Topics Coverage
  subjects: [{
    subject: { type: String, required: true },
    topics: [{
      name: { type: String, required: true },
      targetCompletionDate: { type: Date },
      priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
      status: { type: String, enum: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
      questionsToSolve: { type: Number, default: 50 }
    }],
    weeklyHours: { type: Number }
  }],
  
  // Milestones
  milestones: [{
    title: { type: String, required: true },
    description: { type: String },
    targetDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date }
  }],
  
  // Weekly Goals
  weeklyGoals: [{
    weekNumber: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    goals: [{
      description: { type: String, required: true },
      isCompleted: { type: Boolean, default: false }
    }],
    testsScheduled: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
    isCompleted: { type: Boolean, default: false }
  }],
  
  // Progress Tracking
  progress: {
    completedTopics: { type: Number, default: 0 },
    totalTopics: { type: Number, default: 0 },
    completedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    overallProgress: { type: Number, default: 0 }, // Percentage
    adherenceRate: { type: Number, default: 0 } // How well following the plan
  },
  
  // AI-Generated
  isAIGenerated: { type: Boolean, default: false },
  generatedBy: { type: String }, // AI model name
  
  // Status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'abandoned'],
    default: 'active'
  },
  
  completedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

studyPlanSchema.index({ user: 1, status: 1 });
studyPlanSchema.index({ 'targetExam.examDate': 1 });

// ==========================================
// 11. NEW: PRACTICE SESSION SCHEMA
// ==========================================
const practiceSessionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Session Type
  sessionType: {
    type: String,
    enum: ['topic-wise', 'subject-wise', 'difficulty-based', 'weak-areas', 'random', 'custom'],
    required: true
  },
  
  // Filters
  filters: {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subject: { type: String },
    topics: [{ type: String }],
    difficulty: [{ type: String, enum: ['Easy', 'Medium', 'Hard'] }],
    questionTypes: [{ type: String }],
    isPYQ: { type: Boolean }
  },
  
  // Questions
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  totalQuestions: { type: Number, default: 0 },
  
  // Answers
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedAnswer: { type: String },
    isCorrect: { type: Boolean },
    timeSpent: { type: Number, default: 0 } // seconds
  }],
  
  // Performance
  correctAnswers: { type: Number, default: 0 },
  incorrectAnswers: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  
  // Time
  startTime: { type: Date },
  endTime: { type: Date },
  totalTime: { type: Number, default: 0 }, // seconds
  averageTimePerQuestion: { type: Number, default: 0 },
  
  // Status
  isCompleted: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
});

practiceSessionSchema.index({ user: 1, createdAt: -1 });
practiceSessionSchema.index({ sessionType: 1 });

// ==========================================
// 12. NEW: REVIEW/FEEDBACK SCHEMA
// ==========================================
const reviewSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Review Target
  targetType: {
    type: String,
    enum: ['exam', 'test-series', 'question', 'app'],
    required: true
  },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  testSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  
  // Rating & Review
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String },
  comment: { type: String },
  
  // Aspects (for detailed feedback)
  aspects: {
    difficulty: { type: Number, min: 1, max: 5 },
    clarity: { type: Number, min: 1, max: 5 },
    relevance: { type: Number, min: 1, max: 5 },
    explanationQuality: { type: Number, min: 1, max: 5 }
  },
  
  // Helpful Votes
  helpfulVotes: { type: Number, default: 0 },
  unhelpfulVotes: { type: Number, default: 0 },
  
  // Status
  isVerified: { type: Boolean, default: false }, // Verified user
  isFeatured: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ targetType: 1, exam: 1 });
reviewSchema.index({ targetType: 1, testSeries: 1 });
reviewSchema.index({ user: 1 });

// ==========================================
// 13. NEW: APP SETTINGS SCHEMA (Global Config)
// ==========================================
const appSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Mixed, required: true },
  description: { type: String },
  category: {
    type: String,
    enum: ['general', 'subscription', 'gamification', 'ai', 'limits', 'features'],
    default: 'general'
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    default: 'string'
  },
  isPublic: { type: Boolean, default: false }, // Can users see this?
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

appSettingsSchema.index({ key: 1 });
appSettingsSchema.index({ category: 1 });

// ==========================================
// EXPORT ALL SCHEMAS
// ==========================================
export const User = mongoose.model('User', userSchema);
export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);
export const TestSeries = mongoose.model('TestSeries', testSeriesSchema);
export const TestSeriesEnrollment = mongoose.model('TestSeriesEnrollment', testSeriesEnrollmentSchema);
export const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
export const UserAnalytics = mongoose.model('UserAnalytics', userAnalyticsSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Badge = mongoose.model('Badge', badgeSchema);
export const UserBadge = mongoose.model('UserBadge', userBadgeSchema);
export const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);
export const PracticeSession = mongoose.model('PracticeSession', practiceSessionSchema);
export const Review = mongoose.model('Review', reviewSchema);
export const AppSettings = mongoose.model('AppSettings', appSettingsSchema);