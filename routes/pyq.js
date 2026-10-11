import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getPyqMeta, getPyqPapers, getPyqQuestions } from '../controllers/pyqController.js';
const router = express.Router();
router.get('/meta', authenticate, getPyqMeta);
router.get('/papers', authenticate, getPyqPapers);
router.get('/questions', authenticate, getPyqQuestions);
export default router;
