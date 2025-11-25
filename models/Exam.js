import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { 
    type: String, 
    enum: ['SSC', 'Banking', 'HSSC'], 
    required: true 
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
    order: { type: Number, default: 0 }
  }],
  timePerQuestion: { type: Number }, // Time limit per question in seconds (optional)
  difficultyDistribution: { // Auto-select by difficulty
    easy: { type: Number, default: 0 }, // Percentage
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 }
  },
  tags: [{ type: String }], // Tags for exam organization
  isTemplate: { type: Boolean, default: false }, // If true, this is a reusable template
  templateName: { type: String }, // Name for template
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

