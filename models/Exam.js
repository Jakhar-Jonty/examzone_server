import mongoose from 'mongoose';

// const examSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   description: { type: String, default: '' },
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
//   scheduledTime: { type: Date, required: true },
//   duration: { type: Number, required: true },
//   questions: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Question'
//   }],
//   questionMarks: {
//     type: Map,
//     of: Number,
//     default: {}
//   },
//   totalMarks: { type: Number, required: true },
//   enableNegativeMarking: { type: Boolean, default: false },
//   negativeMarksPerQuestion: { type: Number, default: 0 },
//   language: {
//     type: String,
//     enum: ['Hindi', 'English', 'Both'],
//     default: 'English'
//   },
//   status: { 
//     type: String, 
//     enum: ['draft', 'scheduled', 'active', 'completed'], 
//     default: 'draft' 
//   },
//   expiresAt: { type: Date },
//   allowReattempts: { type: Boolean, default: true },
//   maxAttempts: { type: Number, default: 3 },
//   allowTabSwitch: { type: Boolean, default: false }, // If false, auto-submit on tab switch
//   randomizeQuestions: { type: Boolean, default: false }, // Randomize question order for each attempt
//   sections: [{ // Section-based exams
//     name: { type: String, required: true },
//     description: { type: String },
//     questions: [{
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Question'
//     }],
//     order: { type: Number, default: 0 },
//     questionCount: { type: Number, default: 0 }, // Target number of questions for this section (used in templates and exam creation)
//     // Section-specific settings
//     timeLimit: { type: Number }, // Time limit for this section in minutes (optional)
//     marksPerQuestion: { type: Number }, // Marks per question in this section
//     negativeMarking: { type: Number, default: 0 }, // Negative marks per wrong answer
//     cutoff: { type: Number }, // Sectional cutoff (minimum marks to qualify)
//     isQualifying: { type: Boolean, default: false }, // Qualifying section (doesn't count in final score)
//     isOptional: { type: Boolean, default: false } // Optional section
//   }],
//   enableSectionTiming: { type: Boolean, default: false }, // Enable section-wise timing (each section has its own timer)
//   enableSectionLocking: { type: Boolean, default: false }, // Lock sections after leaving (can't return to completed sections)
//   timePerQuestion: { type: Number }, // Time limit per question in seconds (optional)
//   difficultyDistribution: { // Auto-select by difficulty
//     easy: { type: Number, default: 0 }, // Percentage
//     medium: { type: Number, default: 0 },
//     hard: { type: Number, default: 0 }
//   },
//   tags: [{ type: String }], // Tags for exam organization
//   isTemplate: { type: Boolean, default: false }, // If true, this is a reusable template
//   templateName: { type: String }, // Name for template
//   // Two-stage exam pattern (Prelims + Mains)
//   examPattern: {
//     type: String,
//     enum: ['Single', 'TwoStage'], // Single exam or Prelims+Mains
//     default: 'Single'
//   },
//   prelimsExam: { // If TwoStage, link to prelims exam
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Exam'
//   },
//   mainsExam: { // If TwoStage, link to mains exam
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Exam'
//   },
//   overallCutoff: { type: Number }, // Overall cutoff for the exam
//   recurringSchedule: { // Advanced scheduling
//     enabled: { type: Boolean, default: false },
//     frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
//     daysOfWeek: [{ type: Number }], // 0-6 for weekly
//     timeSlots: [{ // Multiple time slots
//       startTime: { type: String }, // HH:mm format
//       endTime: { type: String },
//       maxParticipants: { type: Number }
//     }],
//     endDate: { type: Date } // When to stop recurring
//   },
//   deleted: { type: Boolean, default: false },
//   deletedAt: { type: Date },
//   deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   createdAt: { type: Date, default: Date.now }
// });

// // Add index for soft delete queries
// examSchema.index({ deleted: 1 });

// // Auto-update status based on time
// examSchema.pre('save', function(next) {
//   const now = new Date();
//   if (this.scheduledTime && this.scheduledTime <= now && this.status === 'scheduled') {
//     this.status = 'active';
//   }
//   if (this.expiresAt && this.expiresAt <= now && this.status === 'active') {
//     this.status = 'completed';
//   }
//   next();
// });




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

  // Ratings (denormalized, updated by reviewController on each review save/delete)
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },

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

export default mongoose.model('Exam', examSchema);

