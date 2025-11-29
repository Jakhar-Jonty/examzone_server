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
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    required: true
  },
  subCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    default: null
  },
  tier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tier',
    default: null
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
subjectTopicSchema.index({ subject: 1, topic: 1, category: 1, subCategory: 1, tier: 1 }, { unique: true });

export default mongoose.model('SubjectTopic', subjectTopicSchema);

