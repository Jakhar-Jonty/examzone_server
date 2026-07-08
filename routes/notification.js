import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  registerToken,
  unregisterToken,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.post('/register-token', authenticate, registerToken);
router.post('/unregister-token', authenticate, unregisterToken);
router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);

export default router;
