import express from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { upload, verifyCloudinaryConfig } from '../config/cloudinary.js';
import {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  deleteQuestions,
  generateAIGuestions,
  saveAIGuestions,
  translateQuestion,
  createExam,
  getExams,
  updateExam,
  publishExam,
  unpublishExam,
  duplicateExam,
  deleteExam,
  restoreExam,
  getDashboardStats,
  getSubjectsAndTopics,
  getUsers,
  upgradeUserSubscription,
  uploadFile,
  getExamTemplates,
  getQuestionBankStats,
  getExamAnalytics,
  getExamPerformanceAnalytics,
  getExamById,
  getQuestionById
} from '../controllers/adminController.js';
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  restoreTemplate,
  duplicateTemplate
} from '../controllers/templateController.js';
import {
  createWordOfDay,
  generateAIWordOfDay,
  getWordsOfDay,
  getWordOfDayById,
  updateWordOfDay,
  deleteWordOfDay,
  createMotivationalQuote,
  generateAIMotivationalQuote,
  getMotivationalQuotes,
  getMotivationalQuoteById,
  updateMotivationalQuote,
  deleteMotivationalQuote
} from '../controllers/contentController.js';
import {
  getPlatformAnalytics,
  getUserAnalyticsList,
  getUserAnalyticsDetail,
  recalculateUserAnalytics
} from '../controllers/analyticsController.js';
import {
  createTestSeries,
  getTestSeries,
  getTestSeriesById,
  updateTestSeries,
  publishTestSeries,
  archiveTestSeries,
  deleteTestSeries,
  getTestSeriesEnrollments
} from '../controllers/testSeriesController.js';
import {
  createBadge,
  getBadges,
  getBadgeById,
  updateBadge,
  deleteBadge,
  toggleBadgeActive,
  awardBadgeToUser,
  getUserBadges,
  revokeUserBadge
} from '../controllers/badgeController.js';

const router = express.Router();

// Question Management - with error handling for file uploads
router.post('/questions', adminAuth, (req, res, next) => {
  upload.single('questionImage')(req, res, (err) => {
    if (err) {
      req.fileError = err;
    }
    next();
  });
}, addQuestion);
router.get('/questions', adminAuth, getQuestions);
router.get('/questions/:id', adminAuth, getQuestionById);
router.put('/questions/:id', adminAuth, (req, res, next) => {
  upload.single('questionImage')(req, res, (err) => {
    if (err) {
      req.fileError = err;
    }
    next();
  });
}, updateQuestion);
router.delete('/questions/:id', adminAuth, deleteQuestion);
router.delete('/questions', adminAuth, deleteQuestions);

// AI Question Generation
router.post('/questions/generate', adminAuth, generateAIGuestions);
router.post('/questions/save-ai', adminAuth, saveAIGuestions);
router.post('/questions/translate', adminAuth, translateQuestion);

// Exam Management
router.post('/exams', adminAuth, createExam);
router.get('/exams', adminAuth, getExams);
// More specific routes must come before parameterized routes
router.get('/exams/templates', adminAuth, getExamTemplates); // Keep for backward compatibility
router.post('/exams/analytics', adminAuth, getExamAnalytics);
router.get('/exams/:id/analytics', adminAuth, getExamPerformanceAnalytics);
router.get('/exams/:id', adminAuth, getExamById);
router.put('/exams/:id', adminAuth, updateExam);
router.post('/exams/:id/publish', adminAuth, publishExam);
router.post('/exams/:id/unpublish', adminAuth, unpublishExam);
router.post('/exams/:id/duplicate', adminAuth, duplicateExam);
router.delete('/exams/:id', adminAuth, deleteExam);
router.post('/exams/:id/restore', adminAuth, restoreExam);

// Template Management (separate collection)
router.post('/templates', adminAuth, createTemplate);
router.get('/templates', adminAuth, getTemplates);
router.get('/templates/:id', adminAuth, getTemplateById);
router.put('/templates/:id', adminAuth, updateTemplate);
router.delete('/templates/:id', adminAuth, deleteTemplate);
router.post('/templates/:id/restore', adminAuth, restoreTemplate);
router.post('/templates/:id/duplicate', adminAuth, duplicateTemplate);

// Dashboard & Users
router.get('/dashboard', adminAuth, getDashboardStats);
router.get('/subjects-topics', adminAuth, getSubjectsAndTopics);
router.get('/users', adminAuth, getUsers);
router.post('/users/:userId/upgrade-subscription', adminAuth, upgradeUserSubscription);

// File Upload
router.post('/upload', adminAuth, upload.single('file'), uploadFile);

// Question Bank Statistics
router.get('/questions/stats', adminAuth, getQuestionBankStats);

// Cloudinary config check endpoint (for debugging)
router.get('/cloudinary-config', adminAuth, (req, res) => {
  const config = verifyCloudinaryConfig();
  res.json({
    configured: config.configured,
    cloud_name: config.cloud_name,
    has_api_key: config.has_api_key,
    has_api_secret: config.has_api_secret,
  });
});

// Word of the Day Management
router.post('/words-of-day', adminAuth, createWordOfDay);
router.post('/words-of-day/generate-ai', adminAuth, generateAIWordOfDay);
router.get('/words-of-day', adminAuth, getWordsOfDay);
router.get('/words-of-day/:id', adminAuth, getWordOfDayById);
router.put('/words-of-day/:id', adminAuth, updateWordOfDay);
router.delete('/words-of-day/:id', adminAuth, deleteWordOfDay);

// Motivational Quote Management
router.post('/motivational-quotes', adminAuth, createMotivationalQuote);
router.post('/motivational-quotes/generate-ai', adminAuth, generateAIMotivationalQuote);
router.get('/motivational-quotes', adminAuth, getMotivationalQuotes);
router.get('/motivational-quotes/:id', adminAuth, getMotivationalQuoteById);
router.put('/motivational-quotes/:id', adminAuth, updateMotivationalQuote);
router.delete('/motivational-quotes/:id', adminAuth, deleteMotivationalQuote);

// Analytics
router.get('/analytics/platform', adminAuth, getPlatformAnalytics);
router.get('/analytics/users', adminAuth, getUserAnalyticsList);
router.get('/analytics/user/:userId', adminAuth, getUserAnalyticsDetail);
router.post('/analytics/recalculate/:userId', adminAuth, recalculateUserAnalytics);

// Test Series Management
router.post('/test-series', adminAuth, createTestSeries);
router.get('/test-series', adminAuth, getTestSeries);
router.get('/test-series/:id/enrollments', adminAuth, getTestSeriesEnrollments);
router.get('/test-series/:id', adminAuth, getTestSeriesById);
router.put('/test-series/:id', adminAuth, updateTestSeries);
router.post('/test-series/:id/publish', adminAuth, publishTestSeries);
router.post('/test-series/:id/archive', adminAuth, archiveTestSeries);
router.delete('/test-series/:id', adminAuth, deleteTestSeries);

// Badge Management
router.post('/badges', adminAuth, createBadge);
router.get('/badges', adminAuth, getBadges);
router.get('/badges/:id', adminAuth, getBadgeById);
router.put('/badges/:id', adminAuth, updateBadge);
router.delete('/badges/:id', adminAuth, deleteBadge);
router.patch('/badges/:id/toggle', adminAuth, toggleBadgeActive);
router.post('/badges/:id/award', adminAuth, awardBadgeToUser);
router.get('/users/:userId/badges', adminAuth, getUserBadges);
router.delete('/users/:userId/badges/:badgeId', adminAuth, revokeUserBadge);

export default router;

