import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  getExamHistory,
  getDashboardStats,
  getAllExams,
  getAnalytics,
  getSubjectsAndTopics,
  saveQuestion,
  unsaveQuestion,
  getSavedQuestions,
  updateSavedQuestion,
  checkSavedQuestions
} from '../controllers/userController.js';
import {
  getCurrentWordOfDay,
  getCurrentMotivationalQuote
} from '../controllers/contentController.js';

const router = express.Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/exam-history', authenticate, getExamHistory);
router.get('/dashboard-stats', authenticate, getDashboardStats);
router.get('/exams', authenticate, getAllExams);
router.get('/analytics', authenticate, getAnalytics);
router.get('/subjects-topics', authenticate, getSubjectsAndTopics);

// Question Bank routes
router.post('/questions/save', authenticate, saveQuestion);
router.delete('/questions/unsave/:questionId', authenticate, unsaveQuestion);
router.get('/questions/saved', authenticate, getSavedQuestions);
router.put('/questions/saved/:savedQuestionId', authenticate, updateSavedQuestion);
router.post('/questions/check-saved', authenticate, checkSavedQuestions);

// Daily Content routes
router.get('/word-of-day', authenticate, getCurrentWordOfDay);
router.get('/motivational-quote', authenticate, getCurrentMotivationalQuote);

export default router;

