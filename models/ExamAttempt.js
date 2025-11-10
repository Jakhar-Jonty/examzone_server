import mongoose from 'mongoose';

const examAttemptSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  exam: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exam', 
    required: true 
  },
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedAnswer: { type: String, enum: ['A', 'B', 'C', 'D', null] },
    isCorrect: { type: Boolean },
    marksObtained: { type: Number, default: 0 }
  }],
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  timeTaken: { type: Number },
  totalScore: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  incorrectAnswers: { type: Number, default: 0 },
  unattempted: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ExamAttempt', examAttemptSchema);

