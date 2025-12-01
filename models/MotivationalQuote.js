import mongoose from 'mongoose';

const motivationalQuoteSchema = new mongoose.Schema({
  quote: { 
    type: String, 
    required: true,
    trim: true
  },
  author: { 
    type: String,
    trim: true,
    default: 'Anonymous'
  },
  category: { 
    type: String,
    enum: ['motivation', 'success', 'perseverance', 'learning', 'exams', 'general'],
    default: 'motivation'
  },
  description: { 
    type: String
  },
  isAIGenerated: { 
    type: Boolean, 
    default: false 
  },
  scheduledDate: { 
    type: Date, 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'published', 'archived'], 
    default: 'draft' 
  },
  publishedAt: { 
    type: Date 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
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

// Index for efficient querying by date
motivationalQuoteSchema.index({ scheduledDate: 1, status: 1 });

motivationalQuoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  next();
});

export default mongoose.model('MotivationalQuote', motivationalQuoteSchema);

