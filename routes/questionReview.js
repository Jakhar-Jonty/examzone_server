import express from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { listQueue, reviewQuestion, generateHaryanaGk } from '../controllers/questionReviewController.js';

const router = express.Router();

// Admin review queue for AI-drafted questions
router.get('/', adminAuth, listQueue);
router.post('/generate/haryana-gk', adminAuth, generateHaryanaGk);
router.post('/:id', adminAuth, reviewQuestion);

export default router;
