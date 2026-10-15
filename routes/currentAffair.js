import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  adminList,
  adminGet,
  adminDraft,
  adminCreate,
  adminUpdate,
  adminPublish,
  adminUnpublish,
  adminDelete,
  list,
  getOne,
  startQuiz,
} from '../controllers/currentAffairController.js';

const router = express.Router();

// Admin: paste news → AI draft → review/edit → publish
router.get('/admin', adminAuth, adminList);
router.post('/admin/draft', adminAuth, adminDraft);
router.post('/admin', adminAuth, adminCreate);
router.get('/admin/:id', adminAuth, adminGet);
router.put('/admin/:id', adminAuth, adminUpdate);
router.post('/admin/:id/publish', adminAuth, adminPublish);
router.post('/admin/:id/unpublish', adminAuth, adminUnpublish);
router.delete('/admin/:id', adminAuth, adminDelete);

// Students
router.get('/', authenticate, list);
router.post('/quiz', authenticate, startQuiz);
router.get('/:id', authenticate, getOne);

export default router;
