import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getLiveMocks, getLeaderboard } from '../controllers/liveMockController.js';

const router = express.Router();

router.get('/', authenticate, getLiveMocks);
router.get('/:id/leaderboard', authenticate, getLeaderboard);

export default router;
