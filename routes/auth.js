import express from 'express';
import { loginIpLimit, loginAccountLimit, otpSendIpLimit, otpSendDestinationLimit, otpVerifyIpLimit } from '../middleware/rateLimits.js';
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

// Limits per network + per account/destination (see middleware/rateLimits.js)
const login = [loginIpLimit, loginAccountLimit];
const sendCode = [otpSendIpLimit, otpSendDestinationLimit];
const checkCode = [otpVerifyIpLimit];

router.post('/register', checkCode, registerController);
router.post('/send-otp', sendCode, sendOTPController);
router.post('/verify-otp', checkCode, verifyOTPController);
router.post('/signup/send-otp', sendCode, signupSendOtpController);
router.post('/signup/verify-otp', checkCode, signupVerifyOtpController);
router.post('/signup/complete', checkCode, signupCompleteController);
router.post('/login', login, loginController);
router.post('/login-otp/send', sendCode, loginOtpSendController);
router.post('/login-otp/verify', login, loginOtpVerifyController);
router.post('/forgot-password', sendCode, forgotPasswordController);
router.post('/reset-password', checkCode, resetPasswordController);
router.post('/set-password', authenticate, setPasswordController);
router.get('/me', authenticate, getMeController);
router.post('/google', loginIpLimit, googleAuthController);

export default router;

