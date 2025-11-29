import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['MCQ', 'TrueFalse', 'NAT', 'AssertionReason', 'MultipleCorrect', 'MatchFollowing', 'FillBlank'],
    default: 'MCQ'
  },
  // Options - optional (not all question types need options)
  options: [{
    optionText: { type: String, required: true },
    optionLabel: { type: String, enum: ['A', 'B', 'C', 'D'], required: true }
  }],
  // Correct answer - flexible based on question type
  correctAnswer: { 
    type: String,
    // For MCQ: 'A', 'B', 'C', 'D'
    // For TrueFalse: 'True', 'False'
    // For NAT: numeric string
    // For AssertionReason: 'A', 'B', 'C', 'D' (A=Both correct, B=Assertion correct, etc.)
    // For MultipleCorrect: comma-separated like 'A,B,C'
    // For MatchFollowing: JSON string
    // For FillBlank: answer text
  },
  // For Assertion-Reason type questions
  assertion: { type: String },
  reason: { type: String },
  // For NAT (Numerical Answer Type)
  correctNumericAnswer: { type: Number },
  numericTolerance: { type: Number, default: 0 }, // Allowed tolerance for numeric answers
  // For Match the Following
  matchPairs: [{
    left: { type: String },
    right: { type: String }
  }],
  // For Multiple Correct Answers
  correctAnswers: [{ type: String }], // Array of correct option labels
  // For Fill Blank
  fillBlankAnswer: { type: String },
  
  explanation: { type: String },
  
  // Hierarchical organization
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
  // Subject as string (backward compatible) - but managed globally via Subject model
  subject: { type: String, required: true },
  topic: { type: String },
  subTopic: { type: String }, // Sub-topic within topic
  chapter: { type: String }, // Chapter/Unit name (for backward compatibility)
  
  marks: { type: Number, default: 1 },
  difficulty: { 
    type: String, 
    enum: ['Easy', 'Medium', 'Hard'], 
    default: 'Medium' 
  },
  language: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },
  questionTextHindi: { type: String },
  optionsHindi: [{
    optionText: { type: String },
    optionLabel: { type: String, enum: ['A', 'B', 'C', 'D'] }
  }],
  explanationHindi: { type: String },
  questionImage: { type: String },
  isAIGenerated: { type: Boolean, default: false },
  tags: [{ type: String }], // Tags for better organization
  usageCount: { type: Number, default: 0 }, // Track how many times used in exams
  lastUsed: { type: Date }, // Last time used in an exam
  
  // PYQ (Previous Year Question) tracking
  isPYQ: { type: Boolean, default: false }, // Is this a previous year question?
  sourceExam: { type: String }, // e.g., "UPSC Prelims 2023", "SSC CGL 2022"
  sourceYear: { type: Number }, // Year of the exam
  paperSet: { type: String }, // Paper set (A, B, C, D) if applicable
  originalQuestionNumber: { type: Number }, // Original question number in the paper
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
questionSchema.index({ category: 1, subCategory: 1, tier: 1 });
questionSchema.index({ subject: 1, topic: 1 });
questionSchema.index({ isPYQ: 1, sourceYear: 1 });
questionSchema.index({ questionType: 1 });
questionSchema.index({ difficulty: 1 });

export default mongoose.model('Question', questionSchema);
