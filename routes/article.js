import express from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { upload } from '../config/cloudinary.js';
import {
  createArticle,
  getAdminArticles,
  updateArticle,
  deleteArticle,
  getArticles,
  getArticle,
  searchArticles
} from '../controllers/articleController.js';

const router = express.Router();

// Admin routes
router.post('/', adminAuth, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'docxFile', maxCount: 1 }
]), createArticle);
router.get('/admin', adminAuth, getAdminArticles);
router.put('/:id', adminAuth, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'docxFile', maxCount: 1 }
]), updateArticle);
router.delete('/:id', adminAuth, deleteArticle);

// Public routes
router.get('/', getArticles);
router.get('/search', searchArticles);
router.get('/:id', getArticle);

export default router;

