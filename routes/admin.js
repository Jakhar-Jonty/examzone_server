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
  deleteExam,
  getDashboardStats,
  getSubjectsAndTopics,
  getUsers,
  uploadFile
} from '../controllers/adminController.js';

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
router.put('/exams/:id', adminAuth, updateExam);
router.post('/exams/:id/publish', adminAuth, publishExam);
router.delete('/exams/:id', adminAuth, deleteExam);

// Dashboard & Users
router.get('/dashboard', adminAuth, getDashboardStats);
router.get('/subjects-topics', adminAuth, getSubjectsAndTopics);
router.get('/users', adminAuth, getUsers);

// File Upload
router.post('/upload', adminAuth, upload.single('file'), uploadFile);

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

