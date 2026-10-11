import express from 'express';
import {
  sendOTPController,
  verifyOTPController,
  loginController,
  loginOtpSendController,
  loginOtpVerifyController,
  signupSendOtpController,
  signupVerifyOtpController,
  signupCompleteController,
  registerController,
  setPasswordController,
  forgotPasswordController,
  resetPasswordController,
  getMeController,
  googleAuthController,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerController);
router.post('/send-otp', sendOTPController);
router.post('/verify-otp', verifyOTPController);
router.post('/signup/send-otp', signupSendOtpController);
router.post('/signup/verify-otp', signupVerifyOtpController);
router.post('/signup/complete', signupCompleteController);
router.post('/login', loginController);
router.post('/login-otp/send', loginOtpSendController);
router.post('/login-otp/verify', loginOtpVerifyController);
router.post('/forgot-password', forgotPasswordController);
router.post('/reset-password', resetPasswordController);
router.post('/set-password', authenticate, setPasswordController);
router.get('/me', authenticate, getMeController);
router.post('/google', googleAuthController);

export default router;

