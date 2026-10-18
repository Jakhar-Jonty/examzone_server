import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { sendOTP, verifyOTP } from '../utils/otpService.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateSignupToken = (email) => {
  return jwt.sign(
    { email, purpose: 'signup' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Signup step 1: send email OTP (reject if email already registered). */
export const signupSendOtpController = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists. Please sign in.' });
    }

    const result = await sendOTP({ channel: 'email', email });
    res.json({
      message: result.mock
        ? 'OTP sent (mock — check server logs)'
        : 'OTP sent to your email',
      mock: result.mock,
      ...(result.debugOtp ? { debugOtp: result.debugOtp } : {}),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/** Signup step 2: verify OTP → short-lived signupToken. */
export const signupVerifyOtpController = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists. Please sign in.' });
    }

    const verification = await verifyOTP({ channel: 'email', email, otp });
    if (!verification.success) {
      return res.status(400).json({ message: verification.message || 'Invalid OTP' });
    }

    const signupToken = generateSignupToken(email);
    res.json({
      message: 'Email verified',
      signupToken,
      email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Signup step 3: create account with signupToken + name + password (+ optional phone). */
export const signupCompleteController = async (req, res) => {
  try {
    const { signupToken, name, password, phoneNumber } = req.body;

    if (!signupToken || !name || !password) {
      return res.status(400).json({ message: 'Signup token, name, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (String(name).trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }

    let payload;
    try {
      payload = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Signup session expired. Please verify your email again.' });
    }

    if (payload.purpose !== 'signup' || !payload.email) {
      return res.status(401).json({ message: 'Invalid signup token' });
    }

    const email = String(payload.email).trim().toLowerCase();
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'An account with this email already exists. Please sign in.' });
    }

    const phone = phoneNumber ? String(phoneNumber).trim() : '';
    if (phone) {
      if (phone.length < 10) {
        return res.status(400).json({ message: 'Enter a valid phone number' });
      }
      const existingPhone = await User.findOne({ phoneNumber: phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
    }

    const user = new User({
      name: String(name).trim(),
      email,
      password,
      isVerified: true,
      preferredLanguage: 'English',
      examPreparations: [],
      ...(phone ? { phoneNumber: phone } : {}),
    });
    await user.save();

    const token = generateToken(user._id);
    const userObj = await User.findById(user._id).select('-password');
    res.status(201).json({ token, user: userObj });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Phone number or email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const sendOTPController = async (req, res) => {
  try {
    const { phoneNumber, email, channel: rawChannel } = req.body;
    const channel = rawChannel === 'email' || email ? 'email' : 'sms';

    if (channel === 'email' && !email) {
      return res.status(400).json({ message: 'Email is required for email OTP' });
    }
    if (channel === 'sms' && !phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required for SMS OTP' });
    }

    const result = await sendOTP({ channel, phoneNumber, email });
    res.json({
      message: result.mock
        ? 'OTP sent (mock — check server logs)'
        : `OTP sent successfully via ${channel}`,
      channel: result.channel,
      mock: result.mock,
      ...(result.debugOtp ? { debugOtp: result.debugOtp } : {}),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyOTPController = async (req, res) => {
  try {
    const {
      phoneNumber,
      email,
      otp,
      name,
      examPreparations,
      preferredLanguage,
      password,
      gender,
      state,
      dateOfBirth,
      channel: rawChannel,
    } = req.body;
    const channel = rawChannel === 'email' || (email && !phoneNumber) ? 'email' : 'sms';

    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }
    if (channel === 'email' && !email) {
      return res.status(400).json({ message: 'Email is required for email OTP' });
    }
    if (channel === 'sms' && !phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required for SMS OTP' });
    }

    const verification = await verifyOTP({ channel, phoneNumber, email, otp });

    if (!verification.success) {
      return res.status(400).json({ message: verification.message || 'Invalid OTP' });
    }

    let user =
      channel === 'email'
        ? await User.findOne({ email: String(email).trim().toLowerCase() })
        : await User.findOne({ phoneNumber });

    const buildNewUserPayload = async () => {
      if (!name) {
        throw Object.assign(new Error('Name is required for registration'), { status: 400 });
      }
      if (password && String(password).length < 6) {
        throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
      }
      const { normalizeExamPreparations } = await import('../utils/examPrepHelper.js');
      const normalizedExamPreps =
        examPreparations && examPreparations.length > 0
          ? await normalizeExamPreparations(examPreparations)
          : [];
      return {
        name,
        examPreparations: normalizedExamPreps,
        preferredLanguage: preferredLanguage || 'English',
        isVerified: true,
        ...(password ? { password } : {}),
        ...(gender ? { gender } : {}),
        ...(state ? { state } : {}),
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      };
    };

    if (!user && channel === 'email') {
      const phone = phoneNumber ? String(phoneNumber).trim() : '';
      if (phone) {
        const existingPhone = await User.findOne({ phoneNumber: phone });
        if (existingPhone) {
          return res.status(400).json({ message: 'Phone number already registered' });
        }
      }
      try {
        const payload = await buildNewUserPayload();
        user = new User({
          ...payload,
          email: String(email).trim().toLowerCase(),
          ...(phone ? { phoneNumber: phone } : {}),
        });
        await user.save();
      } catch (e) {
        return res.status(e.status || 500).json({ message: e.message });
      }
    } else if (!user) {
      try {
        const payload = await buildNewUserPayload();
        user = new User({
          ...payload,
          phoneNumber,
          ...(email ? { email: String(email).trim().toLowerCase() } : {}),
        });
        await user.save();
      } catch (e) {
        return res.status(e.status || 500).json({ message: e.message });
      }
    } else {
      user.isVerified = true;
      if (channel === 'email' && email && !user.email) {
        user.email = String(email).trim().toLowerCase();
      }
      await user.save();
    }

    const token = generateToken(user._id);
    const userObj = await User.findById(user._id).select('-password');

    res.json({
      token,
      user: userObj,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Phone number or email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const loginController = async (req, res) => {
  try {
    const { phoneNumber, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    if (!phoneNumber && !email) {
      return res.status(400).json({ message: 'Phone number or email is required' });
    }

    let user = null;
    if (email) {
      user = await User.findOne({ email: String(email).trim().toLowerCase() });
    } else {
      user = await User.findOne({ phoneNumber: String(phoneNumber).trim() });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({
        message: 'Password not set. Please sign in with email OTP or reset your password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    const userObj = await User.findById(user._id).select('-password');

    res.json({ token, user: userObj });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Send email OTP for passwordless login (only if account exists). */
export const loginOtpSendController = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        message: 'If an account exists for this email, an OTP has been sent',
        sent: false,
      });
    }

    const result = await sendOTP({ channel: 'email', email });
    res.json({
      message: result.mock
        ? 'OTP sent (mock — check server logs)'
        : 'OTP sent to your email',
      sent: true,
      mock: result.mock,
      ...(result.debugOtp ? { debugOtp: result.debugOtp } : {}),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/** Verify email OTP and log in (existing account only). */
export const loginOtpVerifyController = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const verification = await verifyOTP({ channel: 'email', email, otp });
    if (!verification.success) {
      return res.status(400).json({ message: verification.message || 'Invalid OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found for this email. Please sign up.' });
    }

    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id);
    const userObj = await User.findById(user._id).select('-password');
    res.json({ token, user: userObj });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setPasswordController = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    user.password = password;
    await user.save();

    res.json({ message: 'Password set successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Send email OTP for password reset (always generic success if email looks valid). */
export const forgotPasswordController = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const user = await User.findOne({ email });
    // Don't reveal whether the account exists
    if (!user) {
      return res.json({
        message: 'If an account exists for this email, an OTP has been sent',
        sent: false,
      });
    }

    const result = await sendOTP({ channel: 'email', email });
    res.json({
      message: result.mock
        ? 'If an account exists for this email, an OTP has been sent (mock — check server logs)'
        : 'If an account exists for this email, an OTP has been sent',
      sent: true,
      mock: result.mock,
      ...(result.debugOtp ? { debugOtp: result.debugOtp } : {}),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/** Verify email OTP and set a new password. */
export const resetPasswordController = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const verification = await verifyOTP({ channel: 'email', email, otp });
    if (!verification.success) {
      return res.status(400).json({ message: verification.message || 'Invalid OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found for this email' });
    }

    user.password = password;
    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id);
    const userObj = await User.findById(user._id).select('-password');

    res.json({
      message: 'Password reset successfully',
      token,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const registerController = async (req, res) => {
  try {
    const { phoneNumber, password, name, examPreparations, preferredLanguage, gender, state, dateOfBirth } = req.body;

    if (!phoneNumber || !password || !name) {
      return res.status(400).json({ message: 'Phone number, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    // Normalize examPreparations strings → { category: ObjectId } objects before validation
    const { normalizeExamPreparations } = await import('../utils/examPrepHelper.js');
    const normalizedExamPreps = examPreparations && examPreparations.length > 0
      ? await normalizeExamPreparations(examPreparations)
      : [];

    // Create new user
    const user = new User({
      phoneNumber,
      password, // Will be hashed by pre-save hook
      name,
      examPreparations: normalizedExamPreps,
      preferredLanguage: preferredLanguage || 'English',
      isVerified: true,
      ...(gender && { gender }),
      ...(state && { state }),
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
    });

    await user.save();

    const token = generateToken(user._id);

    const userObj = await User.findById(user._id).select('-password');
    res.status(201).json({ token, user: userObj });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Phone number already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};


export const getMeController = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const googleAuthController = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'ID token required' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    // Find by googleId first, then by email (links existing account)
    let user = await User.findOne({ googleId });
    if (!user && email) user = await User.findOne({ email });
    // a brand-new account goes to onboarding (examPreparations can't tell:
    // focus mode pre-fills it on create)
    const isNewUser = !user;

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.profileImage && picture) user.profileImage = picture;
        await user.save();
      }
    } else {
      user = new User({ googleId, email, name, profileImage: picture, isVerified: true });
      await user.save();
    }

    const token = generateToken(user._id);
    const userObj = await User.findById(user._id).select('-password');
    res.json({ token, user: userObj, isNewUser });
  } catch {
    res.status(401).json({ message: 'Invalid Google token' });
  }
};

