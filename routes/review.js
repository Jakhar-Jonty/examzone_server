import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  upsertReview,
  getReviews,
  getMyReview,
  deleteReview,
} from '../controllers/reviewController.js';

const router = express.Router();

router.get('/', authenticate, getReviews);
router.get('/me', authenticate, getMyReview);
router.post('/', authenticate, upsertReview);
router.delete('/:id', authenticate, deleteReview);

export default router;
