import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getPlans, getPlan, createPlan, updatePlan, deletePlan,
  completeMilestone, updateTopicStatus,
} from '../controllers/studyPlanController.js';

const router = express.Router();

router.get('/', authenticate, getPlans);
router.post('/', authenticate, createPlan);
router.get('/:id', authenticate, getPlan);
router.put('/:id', authenticate, updatePlan);
router.delete('/:id', authenticate, deletePlan);
router.patch('/:id/milestone/:milestoneId', authenticate, completeMilestone);
router.patch('/:id/topic-status', authenticate, updateTopicStatus);

export default router;
