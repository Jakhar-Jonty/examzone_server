import mongoose from "mongoose";
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

export default mongoose.model("PracticeSession", practiceSessionSchema);