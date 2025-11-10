import express from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { upload } from '../config/cloudinary.js';
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
  deleteExam,
  getDashboardStats,
  getUsers,
  uploadFile
} from '../controllers/adminController.js';

const router = express.Router();

// Question Management
router.post('/questions', adminAuth, upload.single('questionImage'), addQuestion);
router.get('/questions', adminAuth, getQuestions);
router.put('/questions/:id', adminAuth, upload.single('questionImage'), updateQuestion);
router.delete('/questions/:id', adminAuth, deleteQuestion);
router.delete('/questions', adminAuth, deleteQuestions);

// AI Question Generation
router.post('/questions/generate', adminAuth, generateAIGuestions);
router.post('/questions/save-ai', adminAuth, saveAIGuestions);

// Exam Management
router.post('/exams', adminAuth, createExam);
router.get('/exams', adminAuth, getExams);
router.put('/exams/:id', adminAuth, updateExam);
router.delete('/exams/:id', adminAuth, deleteExam);

// Dashboard & Users
router.get('/dashboard', adminAuth, getDashboardStats);
router.get('/users', adminAuth, getUsers);

// File Upload
router.post('/upload', adminAuth, upload.single('file'), uploadFile);

export default router;

