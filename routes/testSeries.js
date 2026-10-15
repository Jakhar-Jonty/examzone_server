import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getPublishedSeries,
  getSeriesDetail,
  enrollSeries,
  unenrollSeries,
  getMyEnrollments,
} from '../controllers/userTestSeriesController.js';

const router = express.Router();

router.get('/', authenticate, getPublishedSeries);
router.get('/me/enrollments', authenticate, getMyEnrollments);
router.get('/:id', authenticate, getSeriesDetail);
router.post('/:id/enroll', authenticate, enrollSeries);
router.delete('/:id/enroll', authenticate, unenrollSeries);

export default router;
