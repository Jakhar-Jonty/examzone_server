import mongoose from 'mongoose';

const tierSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  code: { 
    type: String, 
    required: true,
    trim: true,
    uppercase: true
  },
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    required: true
  },
  subCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    default: null // null means tier applies to all sub-categories
  },
  order: { 
    type: Number, 
    default: 0 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  description: { 
    type: String,
    trim: true
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
}, {
  timestamps: true
});

// Compound index for efficient queries
tierSchema.index({ category: 1, subCategory: 1, order: 1 });
tierSchema.index({ category: 1, isActive: 1 });

// Static method to get tiers for a category/sub-category combination
tierSchema.statics.getTiersForCategory = function(categoryId, subCategoryId = null) {
  const query = { 
    category: categoryId, 
    isActive: true 
  };
  
  if (subCategoryId) {
    query.$or = [
      { subCategory: subCategoryId },
      { subCategory: null } // Tiers that apply to all sub-categories
    ];
  } else {
    query.subCategory = null;
  }
  
  return this.find(query).sort({ order: 1 });
};

export default mongoose.model('Tier', tierSchema);


