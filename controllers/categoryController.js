import Category from '../models/Category.js';
import Tier from '../models/Tier.js';
import Question from '../models/Question.js';
import Exam from '../models/Exam.js';

// Get all categories with sub-categories, exam counts, and question counts
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('subCategories')
      .sort({ order: 1 })
      .lean(); // Use .lean() for better performance when adding custom fields

    // Organize into tree structure
    const topLevelCategories = categories.filter(cat => !cat.parentCategory);
    const subCategories = categories.filter(cat => cat.parentCategory);

    const categoryIds = topLevelCategories.map(cat => cat._id);
    const subCategoryIds = subCategories.map(sub => sub._id);

    // Get exam counts for all categories and subcategories in one go
    const examCounts = await Exam.aggregate([
      { $match: { 
          $or: [
            { category: { $in: categoryIds } },
            { subCategory: { $in: subCategoryIds } }
          ],
          deleted: { $ne: true } // Exclude deleted exams
      }},
      { $group: {
          _id: {
            category: "$category",
            subCategory: "$subCategory"
          },
          count: { $sum: 1 }
      }}
    ]);

    // Get question counts for all categories and subcategories in one go
    const questionCounts = await Question.aggregate([
      { $match: { 
          $or: [
            { category: { $in: categoryIds } },
            { subCategory: { $in: subCategoryIds } }
          ],
          deleted: { $ne: true } // Exclude deleted questions
      }},
      { $group: {
          _id: {
            category: "$category",
            subCategory: "$subCategory"
          },
          count: { $sum: 1 }
      }}
    ]);

    // Create maps for quick lookup
    const examCountMap = {};
    examCounts.forEach(item => {
      if (item._id.category && !item._id.subCategory) {
        examCountMap[`cat_${item._id.category}`] = (examCountMap[`cat_${item._id.category}`] || 0) + item.count;
      }
      if (item._id.subCategory) {
        examCountMap[`subcat_${item._id.subCategory}`] = (examCountMap[`subcat_${item._id.subCategory}`] || 0) + item.count;
      }
    });

    const questionCountMap = {};
    questionCounts.forEach(item => {
      if (item._id.category && !item._id.subCategory) {
        questionCountMap[`cat_${item._id.category}`] = (questionCountMap[`cat_${item._id.category}`] || 0) + item.count;
      }
      if (item._id.subCategory) {
        questionCountMap[`subcat_${item._id.subCategory}`] = (questionCountMap[`subcat_${item._id.subCategory}`] || 0) + item.count;
      }
    });

    const tree = topLevelCategories.map(category => {
      const subs = subCategories.filter(sub => 
        sub.parentCategory && sub.parentCategory.toString() === category._id.toString()
      );
      return {
        ...category,
        examCount: examCountMap[`cat_${category._id}`] || 0,
        questionCount: questionCountMap[`cat_${category._id}`] || 0,
        subCategories: subs.map(sub => ({
          ...sub,
          examCount: examCountMap[`subcat_${sub._id}`] || 0,
          questionCount: questionCountMap[`subcat_${sub._id}`] || 0
        }))
      };
    });

    res.json({ categories: tree });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single category with sub-categories
export const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('subCategories')
      .populate('parentCategory');

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create category (top-level)
export const createCategory = async (req, res) => {
  try {
    const { name, code, description, order, icon, color } = req.body;

    // Check if code already exists
    const existing = await Category.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Category code already exists' });
    }

    const category = new Category({
      name,
      code: code.toUpperCase(),
      description,
      order: order || 0,
      icon,
      color,
      parentCategory: null,
      createdBy: req.user._id
    });

    await category.save();
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create sub-category
export const createSubCategory = async (req, res) => {
  try {
    const { name, code, description, parentCategoryId, order, icon, color } = req.body;

    // Verify parent category exists
    const parentCategory = await Category.findById(parentCategoryId);
    if (!parentCategory) {
      return res.status(404).json({ message: 'Parent category not found' });
    }

    // Check if code already exists
    const existing = await Category.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Category code already exists' });
    }

    const subCategory = new Category({
      name,
      code: code.toUpperCase(),
      description,
      parentCategory: parentCategoryId,
      order: order || 0,
      icon,
      color,
      createdBy: req.user._id
    });

    await subCategory.save();
    res.status(201).json({ message: 'Sub-category created successfully', category: subCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { name, description, order, icon, color, isActive } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (order !== undefined) category.order = order;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    res.json({ message: 'Category updated successfully', category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete category (soft delete)
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has sub-categories
    const subCategories = await Category.find({ parentCategory: category._id, isActive: true });
    if (subCategories.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with active sub-categories. Delete sub-categories first.' 
      });
    }

    // Check if category is used in questions or exams
    const questionsCount = await Question.countDocuments({ 
      $or: [
        { category: category._id },
        { subCategory: category._id }
      ]
    });
    
    const examsCount = await Exam.countDocuments({ 
      $or: [
        { category: category._id },
        { subCategory: category._id }
      ]
    });

    if (questionsCount > 0 || examsCount > 0) {
      // Soft delete
      category.isActive = false;
      await category.save();
      res.json({ message: 'Category deactivated successfully (in use)', category });
    } else {
      // Hard delete
      await Category.findByIdAndDelete(req.params.id);
      res.json({ message: 'Category deleted successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get tiers for category/sub-category
export const getTiers = async (req, res) => {
  try {
    // Get categoryId from route params (e.g., /categories/:categoryId/tiers)
    const categoryId = req.params.categoryId;
    // Get subCategoryId from query params (e.g., ?subCategoryId=...)
    const subCategoryId = req.query.subCategoryId;
    
    if (!categoryId) {
      return res.status(400).json({ message: 'Category ID is required' });
    }

    const tiers = await Tier.getTiersForCategory(categoryId, subCategoryId || null);
    res.json({ tiers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create tier
export const createTier = async (req, res) => {
  try {
    const { name, code, categoryId, subCategoryId, description, order } = req.body;

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Verify sub-category if provided
    if (subCategoryId) {
      const subCategory = await Category.findById(subCategoryId);
      if (!subCategory || subCategory.parentCategory?.toString() !== categoryId) {
        return res.status(400).json({ message: 'Invalid sub-category for this category' });
      }
    }

    const tier = new Tier({
      name,
      code: code.toUpperCase(),
      category: categoryId,
      subCategory: subCategoryId || null,
      description,
      order: order || 0,
      createdBy: req.user._id
    });

    await tier.save();
    res.status(201).json({ message: 'Tier created successfully', tier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update tier
export const updateTier = async (req, res) => {
  try {
    const { name, description, order, isActive } = req.body;
    const tier = await Tier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({ message: 'Tier not found' });
    }

    if (name) tier.name = name;
    if (description !== undefined) tier.description = description;
    if (order !== undefined) tier.order = order;
    if (isActive !== undefined) tier.isActive = isActive;

    await tier.save();
    res.json({ message: 'Tier updated successfully', tier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete tier
export const deleteTier = async (req, res) => {
  try {
    const tier = await Tier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({ message: 'Tier not found' });
    }

    // Check if tier is used in questions
    const questionsCount = await Question.countDocuments({ tier: tier._id });
    
    if (questionsCount > 0) {
      // Soft delete
      tier.isActive = false;
      await tier.save();
      res.json({ message: 'Tier deactivated successfully (in use)', tier });
    } else {
      // Hard delete
      await Tier.findByIdAndDelete(req.params.id);
      res.json({ message: 'Tier deleted successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
