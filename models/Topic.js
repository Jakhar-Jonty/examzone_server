import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  // Optional: Link to category hierarchy if topic is category-specific
  // If null, topic is global for that subject
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
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
  subTopics: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  usageCount: {
    type: Number,
    default: 1
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index: subject + name + category hierarchy = unique
topicSchema.index({ 
  subject: 1, 
  name: 1, 
  category: 1, 
  subCategory: 1, 
  tier: 1 
}, { unique: true });

topicSchema.index({ subject: 1 });
topicSchema.index({ category: 1, subCategory: 1, tier: 1 });

topicSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Topic', topicSchema);

