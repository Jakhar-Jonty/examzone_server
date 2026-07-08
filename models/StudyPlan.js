import mongoose from "mongoose";

const studyPlanSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Plan Details
  title: { type: String, required: true },
  description: { type: String },
  
  // Target
  targetExam: {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    tier: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
    examDate: { type: Date }
  },
  
  // Duration
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  durationWeeks: { type: Number },
  
  // Daily Schedule
  dailySchedule: {
    studyHoursPerDay: { type: Number, default: 4 },
    preferredTimeSlots: [{
      startTime: { type: String }, // HH:mm format
      endTime: { type: String },
      activity: { type: String, enum: ['study', 'practice', 'test', 'revision'] }
    }],
    restDays: [{ type: Number }] // 0-6 (Sunday-Saturday)
  },
  
  // Subjects & Topics Coverage
  subjects: [{
    subject: { type: String, required: true },
    topics: [{
      name: { type: String, required: true },
      targetCompletionDate: { type: Date },
      priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
      status: { type: String, enum: ['not-started', 'in-progress', 'completed'], default: 'not-started' },
      questionsToSolve: { type: Number, default: 50 }
    }],
    weeklyHours: { type: Number }
  }],
  
  // Milestones
  milestones: [{
    title: { type: String, required: true },
    description: { type: String },
    targetDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date }
  }],
  
  // Weekly Goals
  weeklyGoals: [{
    weekNumber: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    goals: [{
      description: { type: String, required: true },
      isCompleted: { type: Boolean, default: false }
    }],
    testsScheduled: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
    isCompleted: { type: Boolean, default: false }
  }],
  
  // Progress Tracking
  progress: {
    completedTopics: { type: Number, default: 0 },
    totalTopics: { type: Number, default: 0 },
    completedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    overallProgress: { type: Number, default: 0 }, // Percentage
    adherenceRate: { type: Number, default: 0 } // How well following the plan
  },
  
  // AI-Generated
  isAIGenerated: { type: Boolean, default: false },
  generatedBy: { type: String }, // AI model name
  
  // Status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'abandoned'],
    default: 'active'
  },
  
  completedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

studyPlanSchema.index({ user: 1, status: 1 });
studyPlanSchema.index({ 'targetExam.examDate': 1 });

export default mongoose.model("StudyPlan", studyPlanSchema);
