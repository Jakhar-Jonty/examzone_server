import mongoose from "mongoose";

const testSeriesEnrollmentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  testSeries: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TestSeries', 
    required: true 
  },
  
  // Enrollment Details
  enrolledAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  
  // Payment (if paid series)
  isPaid: { type: Boolean, default: false },
  amountPaid: { type: Number, default: 0 },
  paymentId: { type: String },
  transactionDate: { type: Date },
  
  // Progress Tracking
  testsCompleted: { type: Number, default: 0 },
  testsAttempted: { type: Number, default: 0 },
  totalTests: { type: Number, required: true },
  progressPercentage: { type: Number, default: 0 },
  
  currentTest: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  
  // Performance Summary
  averageScore: { type: Number, default: 0 },
  averageAccuracy: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  worstScore: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'cancelled'],
    default: 'active'
  },
  completedAt: { type: Date },
  
  // Certification (if applicable)
  certificateIssued: { type: Boolean, default: false },
  certificateUrl: { type: String },
  certificateIssuedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

testSeriesEnrollmentSchema.index({ user: 1, testSeries: 1 }, { unique: true });
testSeriesEnrollmentSchema.index({ user: 1, status: 1 });


export default mongoose.model("TestSeriesEnrollment", testSeriesEnrollmentSchema);