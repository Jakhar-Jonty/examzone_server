import mongoose from "mongoose";

const leaderboardSchema = new mongoose.Schema({
  // Leaderboard Type
  type: {
    type: String,
    enum: ['exam', 'test-series', 'weekly', 'monthly', 'all-time', 'category'],
    required: true
  },
  
  // Reference (exam or test series)
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  testSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  
  // Time Period (for weekly/monthly)
  startDate: { type: Date },
  endDate: { type: Date },
  
  // Entries
  entries: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rank: { type: Number, required: true },
    score: { type: Number, required: true },
    accuracy: { type: Number },
    timeTaken: { type: Number }, // seconds
    percentile: { type: Number },
    attempts: { type: Number, default: 1 },
    lastAttemptAt: { type: Date },
    
    // Badges for this leaderboard
    badges: [{
      type: String,
      // e.g., 'Top 10', 'Perfect Score', 'Speed Master'
    }]
  }],
  
  // Statistics
  totalParticipants: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  highestScore: { type: Number, default: 0 },
  lowestScore: { type: Number, default: 0 },
  
  // Status
  isLive: { type: Boolean, default: true },
  lastUpdatedAt: { type: Date, default: Date.now },
  
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

leaderboardSchema.index({ type: 1, exam: 1 });
leaderboardSchema.index({ type: 1, testSeries: 1 });
leaderboardSchema.index({ 'entries.user': 1 });
leaderboardSchema.index({ 'entries.rank': 1 });


export default mongoose.model("Leaderboard", leaderboardSchema);