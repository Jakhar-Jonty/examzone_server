import express from 'express';
import {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject,
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  getSubjectsWithTopics
} from '../controllers/subjectController.js';
import { authenticate } from '../middleware/auth.js';
import { adminAuth as isAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes (for dropdowns, etc.)
router.get('/', getSubjects);
router.get('/with-topics', getSubjectsWithTopics);
router.get('/:id', getSubject);
router.get('/:subjectId/topics', getTopics);

// Admin routes
router.post('/', authenticate, isAdmin, createSubject);
router.put('/:id', authenticate, isAdmin, updateSubject);
router.delete('/:id', authenticate, isAdmin, deleteSubject);

// Topic routes
router.post('/topics', authenticate, isAdmin, createTopic);
router.put('/topics/:id', authenticate, isAdmin, updateTopic);
router.delete('/topics/:id', authenticate, isAdmin, deleteTopic);

export default router;

