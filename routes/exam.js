import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAvailableExams,
  getExamDetails,
  startExam,
  saveAnswers,
  submitExam,
  pauseExam,
  getResult,
  getActiveAttempt,
  getOmrPaper
} from '../controllers/examController.js';

const router = express.Router();

router.get('/available', authenticate, getAvailableExams);
router.get('/active-attempt', authenticate, getActiveAttempt);
router.get('/:id/omr-paper', authenticate, getOmrPaper);
router.get('/:id', authenticate, getExamDetails);
router.post('/:id/start', authenticate, startExam);
router.put('/attempt/:attemptId', authenticate, saveAnswers);
router.post('/attempt/:attemptId/pause', authenticate, pauseExam);
router.post('/attempt/:attemptId/submit', authenticate, submitExam);
router.get('/result/:attemptId', authenticate, getResult);

export default router;

