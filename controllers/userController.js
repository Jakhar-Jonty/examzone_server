import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Exam from '../models/Exam.js';
import Article from '../models/Article.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, examPreparations, preferredLanguage } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (email) user.email = email;
    if (examPreparations) user.examPreparations = examPreparations;
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;

    await user.save();

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExamHistory = async (req, res) => {
  try {
    const { category } = req.query;
    const query = { user: req.user._id, isCompleted: true };

    const attempts = await ExamAttempt.find(query)
      .populate({
        path: 'exam',
        match: category ? { category } : {},
        select: 'title category scheduledTime'
      })
      .sort({ createdAt: -1 });

    // Filter out attempts where exam doesn't match category filter
    const filteredAttempts = attempts.filter(attempt => attempt.exam);

    res.json({ attempts: filteredAttempts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();

    // Get available exams
    const availableExams = await Exam.find({
      category: { $in: user.examPreparations },
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: { $lte: now },
      expiresAt: { $gte: now }
    })
    .populate('questions', 'questionText marks')
    .sort({ scheduledTime: -1 })
    .limit(10);

    // Get exam history stats
    const totalAttempts = await ExamAttempt.countDocuments({
      user: user._id,
      isCompleted: true
    });

    const attempts = await ExamAttempt.find({
      user: user._id,
      isCompleted: true
    }).select('totalScore percentage');

    const averageScore = attempts.length > 0
      ? attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length
      : 0;

    // Get recent articles
    const articleQuery = {
      status: 'published',
      category: { $in: user.examPreparations }
    };
    
    // Only filter by isPremium if user is not premium
    if (user.subscriptionStatus !== 'premium') {
      articleQuery.isPremium = false;
    }
    
    const recentArticles = await Article.find(articleQuery)
      .select('title category thumbnail createdAt isPremium')
      .sort({ createdAt: -1 })
      .limit(4);

    // Check weekly limit
    const daysSinceReset = Math.floor((now - user.lastWeekReset) / (1000 * 60 * 60 * 24));
    const weeklyExamsRemaining = user.subscriptionStatus === 'premium'
      ? 'Unlimited'
      : Math.max(0, 3 - user.weeklyExamsAttempted);

    res.json({
      availableExams,
      stats: {
        totalAttempts,
        averageScore: averageScore.toFixed(2),
        weeklyExamsRemaining
      },
      recentArticles,
      subscriptionStatus: user.subscriptionStatus
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

