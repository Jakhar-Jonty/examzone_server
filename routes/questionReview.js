import express from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { listQueue, reviewQuestion, generateHaryanaGk } from '../controllers/questionReviewController.js';
import { listReports, resolveReports } from '../controllers/questionReportController.js';

const router = express.Router();

// Admin review queue for AI-drafted questions
router.get('/', adminAuth, listQueue);
router.post('/generate/haryana-gk', adminAuth, generateHaryanaGk);

// Questions students reported as wrong/unclear
router.get('/reports', adminAuth, listReports);
router.post('/reports/:id', adminAuth, resolveReports);

router.post('/:id', adminAuth, reviewQuestion);

export default router;
