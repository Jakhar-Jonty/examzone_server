
import mongoose from "mongoose";
const reviewSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Review Target
  targetType: {
    type: String,
    enum: ['exam', 'test-series', 'question', 'app'],
    required: true
  },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  testSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  
  // Rating & Review
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String },
  comment: { type: String },
  
  // Aspects (for detailed feedback)
  aspects: {
    difficulty: { type: Number, min: 1, max: 5 },
    clarity: { type: Number, min: 1, max: 5 },
    relevance: { type: Number, min: 1, max: 5 },
    explanationQuality: { type: Number, min: 1, max: 5 }
  },
  
  // Helpful Votes
  helpfulVotes: { type: Number, default: 0 },
  unhelpfulVotes: { type: Number, default: 0 },
  
  // Status
  isVerified: { type: Boolean, default: false }, // Verified user
  isFeatured: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ targetType: 1, exam: 1 });
reviewSchema.index({ targetType: 1, testSeries: 1 });
reviewSchema.index({ user: 1 });

export default mongoose.model("Review", reviewSchema);
