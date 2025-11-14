import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  getExamHistory,
  getDashboardStats,
  getAllExams,
  getAnalytics,
  getSubjectsAndTopics
} from '../controllers/userController.js';

const router = express.Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/exam-history', authenticate, getExamHistory);
router.get('/dashboard-stats', authenticate, getDashboardStats);
router.get('/exams', authenticate, getAllExams);
router.get('/analytics', authenticate, getAnalytics);
router.get('/subjects-topics', authenticate, getSubjectsAndTopics);

export default router;

