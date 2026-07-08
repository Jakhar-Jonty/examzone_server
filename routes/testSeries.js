import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getPublishedSeries,
  getSeriesDetail,
  enrollSeries,
  getMyEnrollments,
} from '../controllers/userTestSeriesController.js';

const router = express.Router();

router.get('/', authenticate, getPublishedSeries);
router.get('/me/enrollments', authenticate, getMyEnrollments);
router.get('/:id', authenticate, getSeriesDetail);
router.post('/:id/enroll', authenticate, enrollSeries);

export default router;
