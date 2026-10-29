import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getOverview, getNotes } from '../controllers/haryanaGkController.js';

const router = express.Router();

router.get('/overview', authenticate, getOverview);
router.get('/notes/:topic', authenticate, getNotes);

export default router;
