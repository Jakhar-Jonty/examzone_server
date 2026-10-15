import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getMyReferral, applyCode } from '../controllers/referralController.js';

const router = express.Router();

router.get('/', authenticate, getMyReferral);
router.post('/apply', authenticate, applyCode);

export default router;
