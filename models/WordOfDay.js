import mongoose from 'mongoose';

const wordOfDaySchema = new mongoose.Schema({
  word: { 
    type: String, 
    required: true,
    trim: true
  },
  pronunciation: { 
    type: String,
    trim: true
  },
  meaning: { 
    type: String, 
    required: true
  },
  example: { 
    type: String
  },
  synonyms: [{ 
    type: String,
    trim: true
  }],
  antonyms: [{ 
    type: String,
    trim: true
  }],
  etymology: { 
    type: String
  },
  usage: { 
    type: String
  },
  isAIGenerated: { 
    type: Boolean, 
    default: false 
  },
  scheduledDate: { 
    type: Date, 
    required: true
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
wordOfDaySchema.index({ scheduledDate: 1, status: 1 });

wordOfDaySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  next();
});

export default mongoose.model('WordOfDay', wordOfDaySchema);

