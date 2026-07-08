import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// const userSchema = new mongoose.Schema({
//   phoneNumber: { 
//     type: String, 
//     required: true, 
//     unique: true,
//     trim: true
//   },
//   name: { 
//     type: String, 
//     required: true,
//     trim: true
//   },
//   email: { 
//     type: String,
//     trim: true,
//     lowercase: true
//   },
//   password: { 
//     type: String
//   },
//   examPreparations: [{ 
//     type: String, 
//     enum: ['SSC', 'Banking', 'HSSC'] 
//   }],
//   preferredLanguage: { 
//     type: String, 
//     enum: ['Hindi', 'English'], 
//     default: 'English' 
//   },
//   role: { 
//     type: String, 
//     enum: ['user', 'admin'], 
//     default: 'user' 
//   },
//   subscriptionStatus: {
//     type: String,
//     enum: ['free', 'premium'],
//     default: 'free'
//   },
//   subscriptionExpiry: { type: Date },
//   weeklyExamsAttempted: { type: Number, default: 0 },
//   lastWeekReset: { type: Date, default: Date.now },
//   // Study Streak fields
//   currentStreak: { type: Number, default: 0 },
//   longestStreak: { type: Number, default: 0 },
//   lastStudyDate: { type: Date },
//   totalStudyDays: { type: Number, default: 0 },
//   badges: [{
//     badgeId: { type: String, required: true },
//     badgeName: { type: String, required: true },
//     earnedAt: { type: Date, default: Date.now }
//   }],
//   profileImage: {
//     type: String // Image URL (uploaded to Cloudinary)
//   },
//   isVerified: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now }
// });

// // Hash password before saving
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password') || !this.password) {
//     return next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// // Method to compare password
// userSchema.methods.comparePassword = async function(candidatePassword) {
//   if (!this.password) return false;
//   return await bcrypt.compare(candidatePassword, this.password);
// };


// ==========================================
// 1. ENHANCED USER SCHEMA
// ==========================================
const userSchema = new mongoose.Schema({
  // Basic Info
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    index: true
  },
  password: { type: String },
  googleId: { type: String, sparse: true, index: true },

  // Profile
  profileImage: { type: String },
  dateOfBirth: { type: Date },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  state: { type: String },
  city: { type: String },
  bio: { type: String, maxlength: 500 },

  // Exam Preparation
  examPreparations: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    tier: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
    targetExamDate: { type: Date },
    isPrimary: { type: Boolean, default: false }
  }],

  preferredLanguage: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },

  // User Preferences & Settings
  preferences: {
    notificationsEnabled: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: true },

    // Study Preferences
    dailyStudyGoal: { type: Number, default: 60 }, // minutes
    preferredStudyTime: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] },
    difficultyPreference: { type: String, enum: ['adaptive', 'easy', 'medium', 'hard'], default: 'adaptive' },

    // Test Preferences
    showAnswersDuringTest: { type: Boolean, default: false },
    showExplanationsAfterTest: { type: Boolean, default: true },
    enableTimer: { type: Boolean, default: true },
    enableNegativeMarking: { type: Boolean, default: true },

    // UI Preferences
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
  },

  // Subscription
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'premium', 'trial'],
    default: 'free'
  },
  subscriptionExpiry: { type: Date },
  trialUsed: { type: Boolean, default: false },

  // Streaks & Gamification
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastStudyDate: { type: Date },
  totalStudyDays: { type: Number, default: 0 },
  totalStudyHours: { type: Number, default: 0 },

  // XP & Levels
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  rank: { type: String, enum: ['Beginner', 'Learner', 'Skilled', 'Expert', 'Master'], default: 'Beginner' },

  // Badges (kept for backward compatibility, but separate Badge collection recommended)
  badges: [{
    badgeId: { type: String, required: true },
    badgeName: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now }
  }],

  // Performance Summary (cached for quick access)
  performanceSummary: {
    totalTestsTaken: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageAccuracy: { type: Number, default: 0 },
    totalQuestionsAttempted: { type: Number, default: 0 },
    totalQuestionsCorrect: { type: Number, default: 0 },
    strongSubjects: [{ type: String }],
    weakSubjects: [{ type: String }],
    lastUpdated: { type: Date }
  },

  // Weekly limits (for free users)
  weeklyExamsAttempted: { type: Number, default: 0 },
  lastWeekReset: { type: Date, default: Date.now },

  // Account Status
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  bannedUntil: { type: Date },

  // Referral System
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCount: { type: Number, default: 0 },

  // Last Activity
  lastLoginAt: { type: Date },
  lastActiveAt: { type: Date },
  loginCount: { type: Number, default: 0 },

  // Device Info (for analytics)
  devices: [{
    deviceId: { type: String },
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    os: { type: String },
    lastUsed: { type: Date }
  }],

  // Expo push tokens (one per device the user installed the app on)
  pushTokens: [{
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'] },
    addedAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ 'examPreparations.category': 1 });
userSchema.index({ subscriptionStatus: 1, subscriptionExpiry: 1 });
userSchema.index({ currentStreak: -1 });
userSchema.index({ xp: -1 });

// Normalize examPreparations before saving to prevent corruption
userSchema.pre('save', async function (next) {
  if (this.isModified('examPreparations') && this.examPreparations && this.examPreparations.length > 0) {
    try {
      const { normalizeExamPreparations } = await import('../utils/examPrepHelper.js');
      const first = this.examPreparations[0];

      // Check if already in correct format: has a category that is a real ObjectId
      const isAlreadyNormalized =
        first &&
        first.category &&
        typeof first.category !== 'string' &&
        !first['0'];

      if (!isAlreadyNormalized) {
        console.log(`🔄 Auto-normalizing examPreparations for user: ${this.name || this.phoneNumber}`);
        // Use $set via direct assignment on the raw array to avoid Mongoose coercion
        const normalized = await normalizeExamPreparations(this.examPreparations);
        this.examPreparations = normalized;
      }
    } catch (error) {
      console.error('Error normalizing examPreparations:', error);
      // Don't block save on normalization error
    }
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};


export default mongoose.model('User', userSchema);

