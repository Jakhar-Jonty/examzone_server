import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';

// Initialize Razorpay only if credentials are available
let razorpay = null;

// Try to load and initialize Razorpay
(async () => {
  try {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const Razorpay = (await import('razorpay')).default;
      razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      console.log('Razorpay initialized successfully');
    } else {
      console.log('Razorpay credentials not found, using mock payment mode');
    }
  } catch (error) {
    console.log('Razorpay module not available, using mock payment mode');
  }
})();

// Get pricing plans
export const getPlans = async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        duration: 'Forever',
        features: [
          '3 exams per week',
          'Basic study materials',
          'Instant results',
          'Ad-supported'
        ]
      },
      {
        id: 'monthly',
        name: 'Monthly Premium',
        price: 299,
        duration: '1 month',
        features: [
          'Unlimited exams',
          'All study materials',
          'Premium articles',
          'Ad-free experience',
          'Priority support'
        ]
      },
      {
        id: 'yearly',
        name: 'Yearly Premium',
        price: 2999,
        duration: '12 months',
        originalPrice: 3588,
        savings: 589,
        features: [
          'Unlimited exams',
          'All study materials',
          'Premium articles',
          'Ad-free experience',
          'Priority support',
          'Save ₹589'
        ]
      }
    ];

    res.json({ plans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create Razorpay order (or mock order if Razorpay not configured)
export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const user = await User.findById(req.user._id);

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    const amount = plan === 'monthly' ? 29900 : 299900; // Amount in paise
    const currency = 'INR';

    // If Razorpay is not configured, use mock order
    if (!razorpay) {
      const mockOrderId = `order_mock_${user._id}_${Date.now()}`;
      return res.json({
        orderId: mockOrderId,
        amount: amount,
        currency: currency,
        isMock: true // Flag to indicate mock payment
      });
    }

    const options = {
      amount,
      currency,
      receipt: `order_${user._id}_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        plan
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      isMock: false
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify payment and activate subscription
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, plan, isMock } = req.body;
    const user = await User.findById(req.user._id);

    if (!orderId || !plan) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    // If mock payment, skip signature verification
    if (isMock || orderId.startsWith('order_mock_')) {
      // Mock payment - accept any paymentId and signature
      if (!paymentId) {
        // Generate mock payment ID
        req.body.paymentId = `pay_mock_${user._id}_${Date.now()}`;
      }
      if (!signature) {
        req.body.signature = 'mock_signature';
      }
    } else {
      // Real Razorpay payment - verify signature
      if (!paymentId || !signature) {
        return res.status(400).json({ message: 'Missing payment details' });
      }

      if (!process.env.RAZORPAY_KEY_SECRET) {
        return res.status(500).json({ message: 'Payment verification not configured' });
      }

      const crypto = await import('crypto');
      const text = `${orderId}|${paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      if (generatedSignature !== signature) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    if (plan === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (plan === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create subscription record
    const subscription = new Subscription({
      user: user._id,
      plan,
      amount: plan === 'monthly' ? 299 : 2999,
      paymentId: paymentId || req.body.paymentId,
      orderId,
      endDate,
      status: 'active'
    });
    await subscription.save();

    // Update user subscription
    user.subscriptionStatus = 'premium';
    user.subscriptionExpiry = endDate;
    await user.save();

    res.json({
      message: isMock || orderId.startsWith('order_mock_') 
        ? 'Subscription activated successfully (Mock Payment)' 
        : 'Subscription activated successfully',
      subscription: {
        plan,
        endDate,
        status: 'active'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get payment history
export const getPaymentHistory = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const router = express.Router();

router.get('/plans', getPlans);
router.post('/create-order', authenticate, createOrder);
router.post('/verify-payment', authenticate, verifyPayment);
router.get('/history', authenticate, getPaymentHistory);

export default router;

