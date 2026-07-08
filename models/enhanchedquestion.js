// ==========================================
// ENHANCED QUESTION & EXAM SCHEMAS + AI FEATURES
// ==========================================

import mongoose from 'mongoose';

// ==========================================
// 1. ENHANCED QUESTION SCHEMA (AI-Ready)
// ==========================================
const questionSchema = new mongoose.Schema({
  // ===== CORE CONTENT =====
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['MCQ', 'TrueFalse', 'NAT', 'AssertionReason', 'MultipleCorrect', 'MatchFollowing', 'FillBlank', 'Comprehension'],
    default: 'MCQ',
    index: true
  },
  
  // Options with enhanced metadata
  options: [{
    optionText: { type: String, required: true },
    optionLabel: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
    explanation: { type: String }, // Why this option is right/wrong
    commonMisconception: { type: String } // Why students might choose this
  }],
  
  // ===== ANSWER HANDLING =====
  correctAnswer: { type: String }, // Primary answer
  correctAnswers: [{ type: String }], // Multiple correct
  correctNumericAnswer: { type: Number },
  numericTolerance: { type: Number, default: 0 },
  numericRange: {
    min: { type: Number },
    max: { type: Number }
  },
  
  // Assertion-Reason
  assertion: { type: String },
  reason: { type: String },
  
  // Match the Following
  matchPairs: [{
    left: { type: String },
    right: { type: String },
    leftLabel: { type: String },
    rightLabel: { type: String }
  }],
  
  // Fill in the Blank
  fillBlankAnswer: { type: String },
  acceptableAnswers: [{ type: String }],
  caseSensitive: { type: Boolean, default: false },
  
  // Explanations
  explanation: { type: String },
  detailedSolution: { type: String },
  videoExplanationUrl: { type: String },
  hintsBeforeSolution: [{ type: String }], // Progressive hints
  
  // ===== HIERARCHICAL ORGANIZATION =====
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    required: true,
    index: true
  },
  subCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    index: true
  },
  tier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tier',
    index: true
  },
  
  subject: { type: String, required: true, index: true },
  topic: { type: String, index: true },
  subTopic: { type: String },
  chapter: { type: String },
  unit: { type: String },
  
  // ===== AI & LEARNING METADATA =====
  
  // Bloom's Taxonomy & Cognitive Levels
  bloomsTaxonomy: {
    type: String,
    enum: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
    index: true
  },
  cognitiveLevel: {
    type: String,
    enum: ['Knowledge', 'Comprehension', 'Application', 'Analysis', 'Synthesis', 'Evaluation']
  },
  
  // Skills & Concepts (Rich metadata for AI)
  skillsTested: [{ 
    type: String,
    // e.g., 'Analytical Reasoning', 'Numerical Ability', 'Reading Comprehension'
  }],
  concepts: [{ type: String }], // Core concepts, e.g., ['Pythagoras Theorem', 'Right Triangle']
  prerequisites: [{ type: String }], // Concepts needed to understand this
  relatedConcepts: [{ type: String }], // Related topics
  
  // Learning Objectives
  learningObjectives: [{ type: String }],
  
  // ===== DIFFICULTY & COMPLEXITY =====
  difficulty: { 
    type: String, 
    enum: ['VeryEasy', 'Easy', 'Medium', 'Hard', 'VeryHard'], 
    default: 'Medium',
    index: true
  },
  estimatedTime: { type: Number }, // seconds
  complexityScore: { type: Number, min: 0, max: 10 },
  
  // Empirical difficulty (learned from student performance)
  empiricalDifficulty: { type: Number, min: 0, max: 1 },
  discriminationIndex: { type: Number }, // How well it separates strong/weak students
  
  // ===== LANGUAGE SUPPORT =====
  language: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },
  
  // Flexible translations array (scalable)
  translations: [{
    language: { type: String, required: true },
    questionText: { type: String },
    options: [{
      optionText: { type: String },
      optionLabel: { type: String }
    }],
    explanation: { type: String },
    detailedSolution: { type: String },
    assertion: { type: String },
    reason: { type: String }
  }],
  
  // Deprecated (backward compatibility)
  questionTextHindi: { type: String },
  optionsHindi: [{ optionText: String, optionLabel: String }],
  explanationHindi: { type: String },
  
  // ===== MEDIA & RICH CONTENT =====
  media: [{
    type: { 
      type: String, 
      enum: ['image', 'audio', 'video', 'diagram', 'graph', 'table']
    },
    url: { type: String, required: true },
    caption: { type: String },
    altText: { type: String },
    position: { 
      type: String, 
      enum: ['question', 'option', 'explanation', 'solution']
    }
  }],
  questionImage: { type: String }, // Backward compatibility
  
  // Content flags
  hasFormula: { type: Boolean, default: false },
  hasTable: { type: Boolean, default: false },
  hasDiagram: { type: Boolean, default: false },
  hasCode: { type: Boolean, default: false },
  
  // ===== PYQ TRACKING =====
  isPYQ: { type: Boolean, default: false, index: true },
  sourceExam: { type: String, index: true },
  sourceYear: { type: Number, index: true },
  paperSet: { type: String },
  session: { type: String },
  originalQuestionNumber: { type: Number },
  examDate: { type: Date },
  shift: { type: String },
  
  // ===== AI GENERATION & SIMILARITY =====
  isAIGenerated: { type: Boolean, default: false },
  aiModel: { type: String }, // e.g., 'GPT-4', 'Claude-3'
  aiGenerationPrompt: { type: String },
  humanVerified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  
  // Question similarity (for finding similar questions)
  similarQuestions: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    similarityScore: { type: Number, min: 0, max: 1 },
    similarityType: { 
      type: String, 
      enum: ['concept', 'structure', 'difficulty', 'topic'] 
    }
  }],
  
  // Embedding for semantic search
  embedding: [{ type: Number }],
  embeddingModel: { type: String },
  
  // Parent question (for comprehension passages)
  parentQuestion: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  linkedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  
  // ===== PERFORMANCE ANALYTICS =====
  marks: { type: Number, default: 1 },
  negativeMarking: { type: Number, default: 0 },
  
  statistics: {
    totalAttempts: { type: Number, default: 0 },
    correctAttempts: { type: Number, default: 0 },
    incorrectAttempts: { type: Number, default: 0 },
    skippedAttempts: { type: Number, default: 0 },
    averageTimeSpent: { type: Number },
    accuracyRate: { type: Number, min: 0, max: 100 },
    
    // Performance by user level
    performanceByLevel: [{
      level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
      accuracyRate: { type: Number }
    }]
  },
  
  usageCount: { type: Number, default: 0 },
  lastUsed: { type: Date },
  
  // ===== QUALITY CONTROL =====
  
  // Content quality flags
  qualityFlags: {
    isReviewed: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    qualityScore: { type: Number, min: 0, max: 100 },
    issues: [{ type: String }]
  },
  
  // User reports
  flags: [{
    type: { 
      type: String, 
      enum: ['Outdated', 'Incorrect', 'Duplicate', 'Unclear', 'Inappropriate', 'TypoError', 'WrongAnswer']
    },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedAt: { type: Date, default: Date.now },
    comment: { type: String },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date }
  }],
  
  // ===== ORGANIZATION =====
  tags: [{ type: String, index: true }],
  keywords: [{ type: String }],
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'UnderReview', 'Published', 'Archived', 'Flagged'],
    default: 'Draft',
    index: true
  },
  publishedAt: { type: Date },
  
  // Version control
  version: { type: Number, default: 1 },
  changeLog: [{
    version: { type: Number },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    changes: { type: String },
    changeType: { type: String, enum: ['created', 'edited', 'verified', 'flagged', 'resolved'] }
  }],
  
  // ===== AUDIT =====
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// ===== INDEXES =====
questionSchema.index({ category: 1, subCategory: 1, tier: 1 });
questionSchema.index({ subject: 1, topic: 1, subTopic: 1 });
questionSchema.index({ isPYQ: 1, sourceYear: 1, sourceExam: 1 });
questionSchema.index({ questionType: 1, difficulty: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ 'statistics.accuracyRate': 1 });
questionSchema.index({ bloomsTaxonomy: 1, cognitiveLevel: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ isAIGenerated: 1, humanVerified: 1 });

// Text search
questionSchema.index({ 
  questionText: 'text', 
  tags: 'text', 
  concepts: 'text',
  keywords: 'text'
});

// ===== MIDDLEWARE =====
questionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-calculate accuracy rate
  if (this.statistics.totalAttempts > 0) {
    this.statistics.accuracyRate = 
      (this.statistics.correctAttempts / this.statistics.totalAttempts) * 100;
  }
  
  next();
});

// ==========================================
// 2. ENHANCED EXAM SCHEMA
// ==========================================
const examSchema = new mongoose.Schema({
  // Basic Info
  title: { type: String, required: true },
  description: { type: String },
  instructions: { type: String },
  thumbnail: { type: String },
  
  // Categorization
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    required: true,
    index: true
  },
  subCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    index: true
  },
  tier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tier',
    index: true
  },
  
  // Exam Type
  examType: {
    type: String,
    enum: ['mock', 'practice', 'sectional', 'pyq', 'full-length', 'quiz', 'adaptive'],
    default: 'mock',
    index: true
  },
  
  // Pattern (Single vs Two-Stage)
  examPattern: {
    type: String,
    enum: ['Single', 'TwoStage'],
    default: 'Single'
  },
  prelimsExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  mainsExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  
  // Scheduling
  scheduledTime: { type: Date, index: true },
  duration: { type: Number, required: true }, // minutes
  expiresAt: { type: Date },
  
  // Questions
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  totalQuestions: { type: Number },
  
  // Custom marks per question (if not uniform)
  questionMarks: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Sections
  sections: [{
    name: { type: String, required: true },
    description: { type: String },
    questions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }],
    order: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 },
    
    // Section settings
    timeLimit: { type: Number },
    marksPerQuestion: { type: Number },
    negativeMarking: { type: Number, default: 0 },
    cutoff: { type: Number },
    isQualifying: { type: Boolean, default: false },
    isOptional: { type: Boolean, default: false }
  }],
  
  enableSectionTiming: { type: Boolean, default: false },
  enableSectionLocking: { type: Boolean, default: false },
  
  // Scoring
  totalMarks: { type: Number, required: true },
  enableNegativeMarking: { type: Boolean, default: false },
  negativeMarksPerQuestion: { type: Number, default: 0 },
  overallCutoff: { type: Number },
  passingMarks: { type: Number },
  
  // Difficulty Distribution
  difficultyDistribution: {
    easy: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 }
  },
  
  // Language
  language: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },
  
  // Test Settings
  allowReattempts: { type: Boolean, default: true },
  maxAttempts: { type: Number, default: 3 },
  allowTabSwitch: { type: Boolean, default: false },
  randomizeQuestions: { type: Boolean, default: false },
  randomizeOptions: { type: Boolean, default: false },
  showResultsImmediately: { type: Boolean, default: true },
  showCorrectAnswers: { type: Boolean, default: true },
  allowQuestionReview: { type: Boolean, default: true },
  
  // Proctoring
  enableProctoring: { type: Boolean, default: false },
  proctoringSettings: {
    detectTabSwitch: { type: Boolean, default: true },
    maxTabSwitches: { type: Number, default: 3 },
    autoSubmitOnExceed: { type: Boolean, default: true },
    requireWebcam: { type: Boolean, default: false },
    requireFullScreen: { type: Boolean, default: false }
  },
  
  // Template
  isTemplate: { type: Boolean, default: false },
  templateName: { type: String },
  createdFromTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  
  // Test Series Link
  testSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  orderInSeries: { type: Number },
  
  // Recurring Schedule
  recurringSchedule: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    daysOfWeek: [{ type: Number }],
    timeSlots: [{
      startTime: { type: String },
      endTime: { type: String },
      maxParticipants: { type: Number }
    }],
    endDate: { type: Date }
  },
  
  // Access Control
  accessType: {
    type: String,
    enum: ['public', 'private', 'premium', 'invite-only'],
    default: 'public'
  },
  isPremium: { type: Boolean, default: false },
  enrollmentRequired: { type: Boolean, default: false },
  
  // Analytics
  statistics: {
    totalAttempts: { type: Number, default: 0 },
    uniqueParticipants: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    lowestScore: { type: Number, default: 0 },
    averageAccuracy: { type: Number, default: 0 },
    averageTime: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'active', 'completed', 'archived'], 
    default: 'draft',
    index: true
  },
  publishedAt: { type: Date },
  
  // Tags
  tags: [{ type: String }],
  
  // Soft Delete
  deleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
examSchema.index({ category: 1, status: 1 });
examSchema.index({ scheduledTime: 1, status: 1 });
examSchema.index({ testSeries: 1, orderInSeries: 1 });
examSchema.index({ deleted: 1 });

// Middleware
examSchema.pre('save', function(next) {
  const now = new Date();
  if (this.scheduledTime && this.scheduledTime <= now && this.status === 'scheduled') {
    this.status = 'active';
  }
  if (this.expiresAt && this.expiresAt <= now && this.status === 'active') {
    this.status = 'completed';
  }
  next();
});

// ==========================================
// 3. NEW: AI MOCK GENERATOR CONFIG SCHEMA
// ==========================================
const aiMockConfigSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Target Exam
  targetCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  targetSubCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  targetTier: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
  
  // Focus Areas (AI will prioritize these)
  focusSubjects: [{ type: String }],
  focusTopics: [{ type: String }],
  weakAreas: [{
    subject: { type: String },
    topic: { type: String },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'high' }
  }],
  
  // Difficulty Preference
  difficultyLevel: {
    type: String,
    enum: ['adaptive', 'beginner', 'intermediate', 'advanced'],
    default: 'adaptive'
  },
  
  // Question Distribution
  questionDistribution: {
    totalQuestions: { type: Number, default: 50 },
    subjectWise: [{
      subject: { type: String, required: true },
      percentage: { type: Number, required: true }
    }],
    difficultyWise: {
      easy: { type: Number, default: 30 }, // percentage
      medium: { type: Number, default: 50 },
      hard: { type: Number, default: 20 }
    }
  },
  
  // Frequency
  frequency: {
    type: String,
    enum: ['daily', 'every-2-days', 'weekly', 'on-demand'],
    default: 'weekly'
  },
  scheduledDay: { type: Number }, // Day of week (0-6)
  scheduledTime: { type: String }, // HH:mm format
  
  // AI Parameters
  aiParameters: {
    includeNewQuestions: { type: Boolean, default: true },
    revisitWrongQuestions: { type: Boolean, default: true },
    adaptToPace: { type: Boolean, default: true }, // Adjust difficulty based on performance
    mixPYQs: { type: Boolean, default: true },
    pyqPercentage: { type: Number, default: 30 }
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  
  // Last Generated
  lastGeneratedAt: { type: Date },
  lastGeneratedExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

aiMockConfigSchema.index({ user: 1, isActive: 1 });

// ==========================================
// 4. NEW: AI GENERATED MOCK HISTORY SCHEMA
// ==========================================
const aiGeneratedMockSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  config: { type: mongoose.Schema.Types.ObjectId, ref: 'AIMockConfig', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  
  // Generation Details
  generatedAt: { type: Date, default: Date.now },
  aiModel: { type: String },
  
  // Selection Criteria Used
  criteriaUsed: {
    weakAreasTargeted: [{ type: String }],
    difficultyAdjustment: { type: String },
    performanceMetrics: {
      recentAccuracy: { type: Number },
      recentAverageScore: { type: Number }
    }
  },
  
  // Questions Selected
  questionsBreakdown: {
    total: { type: Number },
    fromWeakAreas: { type: Number },
    fromStrongAreas: { type: Number },
    newQuestions: { type: Number },
    revisitedQuestions: { type: Number },
    pyqs: { type: Number }
  },
  
  // Performance (filled after attempt)
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamAttempt' },
  score: { type: Number },
  accuracy: { type: Number },
  improvement: { type: Number }, // Compared to previous
  
  createdAt: { type: Date, default: Date.now }
});

aiGeneratedMockSchema.index({ user: 1, generatedAt: -1 });

// ==========================================
// 5. NEW: QUESTION POOL SCHEMA
// (For efficiently managing question sets)
// ==========================================
const questionPoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  
  // Filters
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  tier: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
  
  subjects: [{ type: String }],
  topics: [{ type: String }],
  difficulty: [{ type: String, enum: ['VeryEasy', 'Easy', 'Medium', 'Hard', 'VeryHard'] }],
  questionTypes: [{ type: String }],
  
  // Explicit Question IDs (if manually curated)
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  
  // Dynamic Pool (auto-updates based on filters)
  isDynamic: { type: Boolean, default: false },
  autoUpdateFilters: {
    includeNew: { type: Boolean, default: true }, // Include newly added questions
    excludeUsed: { type: Boolean, default: false }, // Exclude recently used questions
    minQuality: { type: Number, default: 0 }, // Minimum quality score
    maxUsage: { type: Number } // Max times question has been used
  },
  
  // Statistics
  totalQuestions: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  
  // Usage
  usedInExams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
  usageCount: { type: Number, default: 0 },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

questionPoolSchema.index({ category: 1, subjects: 1 });
questionPoolSchema.index({ isDynamic: 1 });

// ==========================================
// EXPORT ALL SCHEMAS
// ==========================================
export const Question = mongoose.model('Question', questionSchema);
export const Exam = mongoose.model('Exam', examSchema);
export const AIMockConfig = mongoose.model('AIMockConfig', aiMockConfigSchema);
export const AIGeneratedMock = mongoose.model('AIGeneratedMock', aiGeneratedMockSchema);
export const QuestionPool = mongoose.model('QuestionPool', questionPoolSchema);