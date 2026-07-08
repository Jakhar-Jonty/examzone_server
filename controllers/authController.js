import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { sendOTP, verifyOTP } from '../utils/otpService.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const sendOTPController = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    await sendOTP(phoneNumber);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyOTPController = async (req, res) => {
  try {
    const { phoneNumber, otp, name, examPreparations, preferredLanguage } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const verification = await verifyOTP(phoneNumber, otp);

    if (!verification.success) {
      return res.status(400).json({ message: verification.message || 'Invalid OTP' });
    }

    let user = await User.findOne({ phoneNumber });

    if (!user) {
      // Register new user
      if (!name) {
        return res.status(400).json({ message: 'Name is required for registration' });
      }

      // Normalize examPreparations to new format
      const { normalizeExamPreparations } = await import('../utils/examPrepHelper.js');
      const normalizedExamPreps = examPreparations && examPreparations.length > 0
        ? await normalizeExamPreparations(examPreparations)
        : [];

      user = new User({
        phoneNumber,
        name,
        examPreparations: normalizedExamPreps,
        preferredLanguage: preferredLanguage || 'English',
        isVerified: true
      });
      await user.save();
    } else {
      // Existing user - just verify
      user.isVerified = true;
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        examPreparations: user.examPreparations,
        preferredLanguage: user.preferredLanguage
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Phone number already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const loginController = async (req, res) => {
  try {
    console.log('Login request received');
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      console.log("Phone number and password are required")
      return res.status(400).json({ message: 'Phone number and password are required' });
    }

    const user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log("Invalid credentials")
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      console.log("Password not set. Please use OTP login.")
      return res.status(401).json({ message: 'Password not set. Please use OTP login.' });
    }

    const isMatch = await user.comparePassword(password);
    console.log("Password match", isMatch)
    if (!isMatch) {
      console.log("Invalid credentials")
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        examPreparations: user.examPreparations,
        preferredLanguage: user.preferredLanguage
      }
    });
  } catch (error) {
    console.log("error in login", error)
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
    res.json({ token, user: userObj, isNewUser: !user.examPreparations?.length });
  } catch {
    res.status(401).json({ message: 'Invalid Google token' });
  }
};

