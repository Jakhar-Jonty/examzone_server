import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendOTP, verifyOTP } from '../utils/otpService.js';

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
      
      user = new User({
        phoneNumber,
        name,
        examPreparations: examPreparations || [],
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
    const { phoneNumber, password } = req.body;
    
    if (!phoneNumber || !password) {
      return res.status(400).json({ message: 'Phone number and password are required' });
    }

    const user = await User.findOne({ phoneNumber });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ message: 'Password not set. Please use OTP login.' });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
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
    const { phoneNumber, password, name, examPreparations, preferredLanguage } = req.body;
    
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

    // Create new user
    const user = new User({
      phoneNumber,
      password, // Will be hashed by pre-save hook
      name,
      examPreparations: examPreparations || [],
      preferredLanguage: preferredLanguage || 'English',
      isVerified: true
    });

    await user.save();

    const token = generateToken(user._id);
    
    res.status(201).json({
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

export const getMeController = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

