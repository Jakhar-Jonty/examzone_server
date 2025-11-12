import mongoose from 'mongoose';

const subjectTopicSchema = new mongoose.Schema({
  subject: { 
    type: String, 
    required: true,
    trim: true
  },
  topic: { 
    type: String, 
    trim: true,
    default: ''
  },
  category: { 
    type: String, 
    enum: ['SSC', 'Banking', 'HSSC'],
    required: true
  },
  usageCount: { 
    type: Number, 
    default: 1 
  },
  lastUsed: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Compound index to ensure uniqueness of subject/topic/category combination
subjectTopicSchema.index({ subject: 1, topic: 1, category: 1 }, { unique: true });

export default mongoose.model('SubjectTopic', subjectTopicSchema);

