import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    required: true 
  },
  subCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    default: null
  },
  tier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tier',
    default: null
  },
  scheduledTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  questionMarks: {
    type: Map,
    of: Number,
    default: {}
  },
  totalMarks: { type: Number, required: true },
  enableNegativeMarking: { type: Boolean, default: false },
  negativeMarksPerQuestion: { type: Number, default: 0 },
  language: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'active', 'completed'], 
    default: 'draft' 
  },
  expiresAt: { type: Date },
  allowReattempts: { type: Boolean, default: true },
  maxAttempts: { type: Number, default: 3 },
  allowTabSwitch: { type: Boolean, default: false }, // If false, auto-submit on tab switch
  randomizeQuestions: { type: Boolean, default: false }, // Randomize question order for each attempt
  sections: [{ // Section-based exams
    name: { type: String, required: true },
    description: { type: String },
    questions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }],
    order: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 }, // Target number of questions for this section (used in templates and exam creation)
    // Section-specific settings
    timeLimit: { type: Number }, // Time limit for this section in minutes (optional)
    marksPerQuestion: { type: Number }, // Marks per question in this section
    negativeMarking: { type: Number, default: 0 }, // Negative marks per wrong answer
    cutoff: { type: Number }, // Sectional cutoff (minimum marks to qualify)
    isQualifying: { type: Boolean, default: false }, // Qualifying section (doesn't count in final score)
    isOptional: { type: Boolean, default: false } // Optional section
  }],
  enableSectionTiming: { type: Boolean, default: false }, // Enable section-wise timing (each section has its own timer)
  enableSectionLocking: { type: Boolean, default: false }, // Lock sections after leaving (can't return to completed sections)
  timePerQuestion: { type: Number }, // Time limit per question in seconds (optional)
  difficultyDistribution: { // Auto-select by difficulty
    easy: { type: Number, default: 0 }, // Percentage
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 }
  },
  tags: [{ type: String }], // Tags for exam organization
  isTemplate: { type: Boolean, default: false }, // If true, this is a reusable template
  templateName: { type: String }, // Name for template
  // Two-stage exam pattern (Prelims + Mains)
  examPattern: {
    type: String,
    enum: ['Single', 'TwoStage'], // Single exam or Prelims+Mains
    default: 'Single'
  },
  prelimsExam: { // If TwoStage, link to prelims exam
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  },
  mainsExam: { // If TwoStage, link to mains exam
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  },
  overallCutoff: { type: Number }, // Overall cutoff for the exam
  recurringSchedule: { // Advanced scheduling
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    daysOfWeek: [{ type: Number }], // 0-6 for weekly
    timeSlots: [{ // Multiple time slots
      startTime: { type: String }, // HH:mm format
      endTime: { type: String },
      maxParticipants: { type: Number }
    }],
    endDate: { type: Date } // When to stop recurring
  },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Add index for soft delete queries
examSchema.index({ deleted: 1 });

// Auto-update status based on time
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

