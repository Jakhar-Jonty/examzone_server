import mongoose from 'mongoose';

const savedQuestionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  savedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['needs-review', 'mastered', 'reviewed'],
    default: 'needs-review'
  },
  source: {
    type: String,
    enum: ['manual', 'auto'],
    default: 'manual'
  },
  wrongCount: {
    type: Number,
    default: 0
  },
  lastWrongAt: Date,
  lastWrongAnswer: String,
  lastExamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  },
  subject: String,
  topic: String
}, {
  timestamps: true
});

savedQuestionSchema.index({ user: 1, question: 1 }, { unique: true });
savedQuestionSchema.index({ user: 1, source: 1, status: 1 });
savedQuestionSchema.index({ user: 1, tags: 1 });

export default mongoose.model('SavedQuestion', savedQuestionSchema);

