import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { reportQuestion } from '../controllers/questionReportController.js';
import { reportLimit } from '../middleware/rateLimits.js';

const router = express.Router();

// Students report a wrong/unclear question; it lands in the admin "Reported" list
router.post('/:id/report', authenticate, reportLimit, reportQuestion);

export default router;
