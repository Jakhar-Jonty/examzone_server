import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getOverview } from '../controllers/haryanaGkController.js';

const router = express.Router();

router.get('/overview', authenticate, getOverview);

export default router;
