import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getSessions, getSession, createSession, saveAnswer, completeSession, getStats,
} from '../controllers/practiceSessionController.js';

const router = express.Router();

router.get('/', authenticate, getSessions);
router.post('/', authenticate, createSession);
router.get('/stats', authenticate, getStats);
router.get('/:id', authenticate, getSession);
router.patch('/:id/answer', authenticate, saveAnswer);
router.patch('/:id/complete', authenticate, completeSession);

export default router;
