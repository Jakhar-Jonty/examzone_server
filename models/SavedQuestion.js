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
  }
}, {
  timestamps: true
});

// Ensure a user can't save the same question twice
savedQuestionSchema.index({ user: 1, question: 1 }, { unique: true });

export default mongoose.model('SavedQuestion', savedQuestionSchema);

