import mongoose from 'mongoose';

// const questionSchema = new mongoose.Schema({
//   questionText: { type: String, required: true },
//   questionType: {
//     type: String,
//     enum: ['MCQ', 'TrueFalse', 'NAT', 'AssertionReason', 'MultipleCorrect', 'MatchFollowing', 'FillBlank'],
//     default: 'MCQ'
//   },
//   // Options - optional (not all question types need options)
//   options: [{
//     optionText: { type: String, required: true },
//     optionLabel: { type: String, enum: ['A', 'B', 'C', 'D'], required: true }
//   }],
//   // Correct answer - flexible based on question type
//   correctAnswer: { 
//     type: String,
//     // For MCQ: 'A', 'B', 'C', 'D'
//     // For TrueFalse: 'True', 'False'
//     // For NAT: numeric string
//     // For AssertionReason: 'A', 'B', 'C', 'D' (A=Both correct, B=Assertion correct, etc.)
//     // For MultipleCorrect: comma-separated like 'A,B,C'
//     // For MatchFollowing: JSON string
//     // For FillBlank: answer text
//   },
//   // For Assertion-Reason type questions
//   assertion: { type: String },
//   reason: { type: String },
//   // For NAT (Numerical Answer Type)
//   correctNumericAnswer: { type: Number },
//   numericTolerance: { type: Number, default: 0 }, // Allowed tolerance for numeric answers
//   // For Match the Following
//   matchPairs: [{
//     left: { type: String },
//     right: { type: String }
//   }],
//   // For Multiple Correct Answers
//   correctAnswers: [{ type: String }], // Array of correct option labels
//   // For Fill Blank
//   fillBlankAnswer: { type: String },
  
//   explanation: { type: String },
  
//   // Hierarchical organization
//   category: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Category',
//     required: true 
//   },
//   subCategory: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Category',
//     default: null
//   },
//   tier: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Tier',
//     default: null
//   },
//   // Subject as string (backward compatible) - but managed globally via Subject model
//   subject: { type: String, required: true },
//   topic: { type: String },
//   subTopic: { type: String }, // Sub-topic within topic
//   chapter: { type: String }, // Chapter/Unit name (for backward compatibility)
  
//   marks: { type: Number, default: 1 },
//   difficulty: { 
//     type: String, 
//     enum: ['Easy', 'Medium', 'Hard'], 
//     default: 'Medium' 
//   },
//   language: {
//     type: String,
//     enum: ['Hindi', 'English', 'Both'],
//     default: 'English'
//   },
//   questionTextHindi: { type: String },
//   optionsHindi: [{
//     optionText: { type: String },
//     optionLabel: { type: String, enum: ['A', 'B', 'C', 'D'] }
//   }],
//   explanationHindi: { type: String },
//   questionImage: { type: String },
//   isAIGenerated: { type: Boolean, default: false },
//   tags: [{ type: String }], // Tags for better organization
//   usageCount: { type: Number, default: 0 }, // Track how many times used in exams
//   lastUsed: { type: Date }, // Last time used in an exam
  
//   // PYQ (Previous Year Question) tracking
//   isPYQ: { type: Boolean, default: false }, // Is this a previous year question?
//   sourceExam: { type: String }, // e.g., "UPSC Prelims 2023", "SSC CGL 2022"
//   sourceYear: { type: Number }, // Year of the exam
//   paperSet: { type: String }, // Paper set (A, B, C, D) if applicable
//   originalQuestionNumber: { type: Number }, // Original question number in the paper
  
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   createdAt: { type: Date, default: Date.now }
// });

// // Indexes for efficient queries
// questionSchema.index({ category: 1, subCategory: 1, tier: 1 });
// questionSchema.index({ subject: 1, topic: 1 });
// questionSchema.index({ isPYQ: 1, sourceYear: 1 });
// questionSchema.index({ questionType: 1 });
// questionSchema.index({ difficulty: 1 });



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


export default mongoose.model('Question', questionSchema);
