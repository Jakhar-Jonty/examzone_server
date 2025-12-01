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

export default router;

