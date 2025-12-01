import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  templateName: { type: String, required: true },
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
  duration: { type: Number, default: 0 }, // Duration in minutes (0 if section-wise timing)
  language: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },
  marksPerQuestion: { type: Number, default: 1 },
  sections: [{ // Section-based templates
    name: { type: String, required: true },
    description: { type: String },
    questionCount: { type: Number, required: true }, // Target number of questions for this section
    order: { type: Number, default: 0 },
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
  tags: [{ type: String }], // Tags for template organization
  allowReattempts: { type: Boolean, default: true },
  maxAttempts: { type: Number, default: 3 },
  allowTabSwitch: { type: Boolean, default: false },
  enableNegativeMarking: { type: Boolean, default: false },
  negativeMarksPerQuestion: { type: Number, default: 0 },
  randomizeQuestions: { type: Boolean, default: false },
  // Two-stage exam pattern (Prelims + Mains)
  examPattern: {
    type: String,
    enum: ['Single', 'TwoStage'],
    default: 'Single'
  },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add index for soft delete queries
templateSchema.index({ deleted: 1 });
templateSchema.index({ category: 1 });
templateSchema.index({ createdBy: 1 });

// Update updatedAt before saving
templateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Template', templateSchema);

