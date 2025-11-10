import express from 'express';
import {
  sendOTPController,
  verifyOTPController,
  loginController,
  registerController,
  setPasswordController,
  getMeController
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerController);
router.post('/send-otp', sendOTPController);
router.post('/verify-otp', verifyOTPController);
router.post('/login', loginController);
router.post('/set-password', authenticate, setPasswordController);
router.get('/me', authenticate, getMeController);

export default router;

