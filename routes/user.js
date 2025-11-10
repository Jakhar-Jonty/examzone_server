import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  getExamHistory,
  getDashboardStats
} from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/exam-history', authenticate, getExamHistory);
router.get('/dashboard-stats', authenticate, getDashboardStats);

export default router;

