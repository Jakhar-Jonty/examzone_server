import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Notification Content
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Type & Category
  type: {
    type: String,
    enum: [
      'exam-reminder', 
      'test-series-update', 
      'streak-reminder',
      'achievement',
      'rank-update',
      'new-content',
      'subscription',
      'system',
      'promotional'
    ],
    required: true
  },
  
  category: {
    type: String,
    enum: ['exam', 'achievement', 'reminder', 'update', 'alert', 'marketing'],
    default: 'update'
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Reference Objects
  relatedExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  relatedTestSeries: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  relatedBadge: { type: String },
  
  // Action
  actionUrl: { type: String }, // Deep link or URL
  actionText: { type: String }, // Button text like "Start Exam", "View Results"
  
  // Icon & Styling
  icon: { type: String },
  iconColor: { type: String },
  image: { type: String },
  
  // Status
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  
  // Delivery
  deliveryChannel: {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  
  // Scheduling
  scheduledFor: { type: Date }, // For scheduled notifications
  
  // Grouping (to prevent spam)
  groupKey: { type: String }, // Group similar notifications
  
  // Expiry
  expiresAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });


export default mongoose.model("Notification", notificationSchema);