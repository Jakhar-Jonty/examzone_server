import express from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  createSubCategory,
  updateCategory,
  deleteCategory,
  getTiers,
  createTier,
  updateTier,
  deleteTier
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { adminAuth as isAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes (for dropdowns, etc.)
// Note: More specific routes must come before parameterized routes
router.get('/', getCategories);
router.get('/:categoryId/tiers', getTiers); // Must come before /:id route
router.get('/:id', getCategory);

// Admin routes
router.post('/', authenticate, isAdmin, createCategory);
router.post('/subcategory', authenticate, isAdmin, createSubCategory);
router.put('/:id', authenticate, isAdmin, updateCategory);
router.delete('/:id', authenticate, isAdmin, deleteCategory);

// Tier routes
router.post('/tiers', authenticate, isAdmin, createTier);
router.put('/tiers/:id', authenticate, isAdmin, updateTier);
router.delete('/tiers/:id', authenticate, isAdmin, deleteTier);

export default router;
