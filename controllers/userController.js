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

    // Get attempt information for each exam
    const examIds = availableExams.map(exam => exam._id);
    const attempts = await ExamAttempt.find({
      user: user._id,
      exam: { $in: examIds }
    }).select('exam isCompleted isPaused _id');

    // Map attempts to exams
    const attemptMap = {};
    attempts.forEach(attempt => {
      attemptMap[attempt.exam.toString()] = {
        attemptId: attempt._id,
        isCompleted: attempt.isCompleted,
        isPaused: attempt.isPaused
      };
    });

    // Add attempt info to exams
    const examsWithAttempts = availableExams.map(exam => {
      const attemptInfo = attemptMap[exam._id.toString()];
      return {
        ...exam.toObject(),
        isAttempted: attemptInfo?.isCompleted || false,
        isPaused: attemptInfo?.isPaused || false,
        attemptId: attemptInfo?.attemptId || null
      };
    });

    // Get exam history stats
    const totalAttempts = await ExamAttempt.countDocuments({
      user: user._id,
      isCompleted: true
    });

    const completedAttempts = await ExamAttempt.find({
      user: user._id,
      isCompleted: true
    }).select('totalScore percentage');

    const averageScore = completedAttempts.length > 0
      ? completedAttempts.reduce((sum, a) => sum + a.percentage, 0) / completedAttempts.length
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
      availableExams: examsWithAttempts,
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

export const getAnalytics = async (req, res) => {
  try {
    const { timeRange = 'all' } = req.query;
    const user = req.user._id;
    const now = new Date();
    
    // Calculate date range
    let startDate = new Date(0); // Beginning of time
    if (timeRange === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'quarter') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // Get all attempts in time range
    const allAttempts = await ExamAttempt.find({
      user,
      isCompleted: true,
      createdAt: { $gte: startDate }
    })
      .populate('exam', 'title category totalMarks')
      .sort({ createdAt: -1 });

    // Overall stats
    const totalAttempts = allAttempts.length;
    const averageScore = totalAttempts > 0
      ? allAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts
      : 0;
    const bestScore = totalAttempts > 0
      ? Math.max(...allAttempts.map(a => a.percentage))
      : 0;

    // Subject-wise performance (group by category since exams don't have subject field)
    const subjectMap = {};
    allAttempts.forEach(attempt => {
      const subject = attempt.exam?.category || 'General';
      if (!subjectMap[subject]) {
        subjectMap[subject] = {
          subject,
          attempts: [],
          totalScore: 0,
          count: 0
        };
      }
      subjectMap[subject].attempts.push(attempt.percentage);
      subjectMap[subject].totalScore += attempt.percentage;
      subjectMap[subject].count += 1;
    });

    const subjectPerformance = Object.values(subjectMap).map(subj => ({
      subject: subj.subject,
      attempts: subj.count,
      averageScore: subj.totalScore / subj.count,
      bestScore: Math.max(...subj.attempts)
    })).sort((a, b) => b.averageScore - a.averageScore);

    // Recent attempts for trend
    const recentAttempts = allAttempts.slice(0, 10).map(attempt => ({
      _id: attempt._id,
      examTitle: attempt.exam?.title || 'Unknown',
      score: attempt.totalScore,
      totalMarks: attempt.exam?.totalMarks || attempt.totalScore,
      percentage: attempt.percentage,
      date: new Date(attempt.createdAt).toLocaleDateString()
    }));

    // Calculate trends (compare with previous period)
    let previousPeriodAttempts = [];
    if (timeRange !== 'all') {
      const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
      previousPeriodAttempts = await ExamAttempt.find({
        user,
        isCompleted: true,
        createdAt: { $gte: previousStartDate, $lt: startDate }
      }).select('percentage');
    }

    const previousAverage = previousPeriodAttempts.length > 0
      ? previousPeriodAttempts.reduce((sum, a) => sum + a.percentage, 0) / previousPeriodAttempts.length
      : averageScore;

    const scoreChange = previousAverage > 0
      ? ((averageScore - previousAverage) / previousAverage) * 100
      : 0;

    const attemptsChange = previousPeriodAttempts.length > 0
      ? ((totalAttempts - previousPeriodAttempts.length) / previousPeriodAttempts.length) * 100
      : 0;

    // Calculate improvement rate (comparing first half vs second half)
    const midPoint = Math.floor(allAttempts.length / 2);
    const firstHalf = allAttempts.slice(midPoint).map(a => a.percentage);
    const secondHalf = allAttempts.slice(0, midPoint).map(a => a.percentage);
    
    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length
      : 0;

    const improvementRate = firstHalfAvg > 0
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
      : 0;

    res.json({
      stats: {
        totalAttempts,
        averageScore,
        bestScore
      },
      subjectPerformance,
      recentAttempts,
      trends: {
        scoreChange,
        attemptsChange,
        improvementRate
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

