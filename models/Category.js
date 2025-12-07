import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  code: { 
    type: String, 
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  parentCategory: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category',
    default: null // null means it's a top-level category
  },
  order: { 
    type: Number, 
    default: 0 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  icon: { 
    type: String // Icon name or URL for UI
  },
  logo: {
    type: String // Logo/image URL (uploaded to Cloudinary)
  },
  color: { 
    type: String // Hex color code for UI
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
// Note: code field already has unique: true which creates an index
categorySchema.index({ parentCategory: 1, order: 1 });
categorySchema.index({ isActive: 1 });

// Virtual for sub-categories
categorySchema.virtual('subCategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory'
});

// Method to check if category is a top-level category
categorySchema.methods.isTopLevel = function() {
  return !this.parentCategory;
};

// Static method to get all top-level categories
categorySchema.statics.getTopLevelCategories = function() {
  return this.find({ parentCategory: null, isActive: true }).sort({ order: 1 });
};

// Static method to get sub-categories of a category
categorySchema.statics.getSubCategories = function(parentId) {
  return this.find({ parentCategory: parentId, isActive: true }).sort({ order: 1 });
};

export default mongoose.model('Category', categorySchema);
