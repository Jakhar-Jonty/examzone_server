import User from '../models/User.js';
import Question from '../models/Question.js';
import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import UserAnalytics from '../models/UserAnalytics.js';
import TestSeries from '../models/TestSeries.js';
import mongoose from 'mongoose';

// =============================================================
// GET /admin/analytics/platform
// =============================================================
export const getPlatformAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const today = new Date(); today.setHours(0, 0, 0, 0);

        // ---- KPI Counts ----
        const [
            totalUsers,
            totalQuestions,
            totalPublishedExams,
            totalTestSeries,
            totalAttempts,
            todayAttempts,
            weekAttempts,
            newUsersThisWeek,
        ] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            Question.countDocuments({ status: 'Published' }),
            Exam.countDocuments({ status: { $in: ['active', 'scheduled'] } }),
            TestSeries.countDocuments({ status: 'published' }),
            ExamAttempt.countDocuments({ isCompleted: true }),
            ExamAttempt.countDocuments({ isCompleted: true, createdAt: { $gte: today } }),
            ExamAttempt.countDocuments({ isCompleted: true, createdAt: { $gte: sevenDaysAgo } }),
            User.countDocuments({ role: 'user', createdAt: { $gte: sevenDaysAgo } }),
        ]);

        // ---- Attempts per day (last 30 days) ----
        const attemptsPerDay = await ExamAttempt.aggregate([
            { $match: { isCompleted: true, createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    avgScore: { $avg: '$percentage' },
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // ---- User registrations per day (last 30 days) ----
        const usersPerDay = await User.aggregate([
            { $match: { role: 'user', createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // ---- Overall accuracy from all attempts ----
        const accuracyAgg = await ExamAttempt.aggregate([
            { $match: { isCompleted: true } },
            { $group: { _id: null, avgAccuracy: { $avg: '$percentage' } } }
        ]);
        const overallAccuracy = Math.round(accuracyAgg[0]?.avgAccuracy || 0);

        // ---- Top 5 most-attempted exams ----
        const topExams = await ExamAttempt.aggregate([
            { $match: { isCompleted: true } },
            { $group: { _id: '$exam', attempts: { $sum: 1 }, avgScore: { $avg: '$percentage' } } },
            { $sort: { attempts: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'exams', localField: '_id', foreignField: '_id', as: 'exam' } },
            { $unwind: '$exam' },
            { $project: { title: '$exam.title', attempts: 1, avgScore: { $round: ['$avgScore', 1] } } }
        ]);

        // ---- Question stats by difficulty ----
        const questionsByDifficulty = await Question.aggregate([
            { $match: { status: 'Published' } },
            { $group: { _id: '$difficulty', count: { $sum: 1 } } }
        ]);

        // ---- Subject-wise accuracy (from UserAnalytics) ----
        const subjectAccuracy = await UserAnalytics.aggregate([
            { $unwind: '$subjectWiseStats' },
            {
                $group: {
                    _id: '$subjectWiseStats.subject',
                    avgAccuracy: { $avg: '$subjectWiseStats.accuracy' },
                    userCount: { $sum: 1 }
                }
            },
            { $match: { _id: { $ne: null } } },
            { $sort: { userCount: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            kpi: {
                totalUsers,
                totalQuestions,
                totalPublishedExams,
                totalTestSeries,
                totalAttempts,
                todayAttempts,
                weekAttempts,
                newUsersThisWeek,
                overallAccuracy,
            },
            charts: {
                attemptsPerDay,
                usersPerDay,
                questionsByDifficulty,
                subjectAccuracy,
            },
            topExams,
        });
    } catch (error) {
        console.error('Platform analytics error:', error);
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/analytics/users
// Paginated list of users with their analytics summary
// =============================================================
export const getUserAnalyticsList = async (req, res) => {
    try {
        const { page = 1, limit = 20, sort = 'totalTests' } = req.query;
        const skip = (page - 1) * limit;

        const sortMap = {
            totalTests: { 'overallStats.totalTestsTaken': -1 },
            accuracy: { 'overallStats.overallAccuracy': -1 },
            recent: { 'overallStats.lastTestDate': -1 },
        };
        const sortQuery = sortMap[sort] || sortMap.totalTests;

        const [analytics, total] = await Promise.all([
            UserAnalytics.find()
                .populate('user', 'name email phoneNumber')
                .sort(sortQuery)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            UserAnalytics.countDocuments()
        ]);

        res.json({
            analytics,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/analytics/user/:userId
// Detailed analytics for a specific user
// =============================================================
export const getUserAnalyticsDetail = async (req, res) => {
    try {
        const { userId } = req.params;
        const analyticsDoc = await UserAnalytics.findOne({ user: userId })
            .populate('user', 'name email phoneNumber createdAt')
            .lean();

        if (!analyticsDoc) {
            return res.status(404).json({ message: 'No analytics found for this user yet.' });
        }

        // Also fetch recent attempts
        const recentAttempts = await ExamAttempt.find({ user: userId, isCompleted: true })
            .populate('exam', 'title')
            .sort({ createdAt: -1 })
            .limit(10)
            .select('exam percentage totalScore createdAt timeTaken')
            .lean();

        res.json({ analytics: analyticsDoc, recentAttempts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// POST /admin/analytics/recalculate/:userId
// Recalculate UserAnalytics for a specific user from ExamAttempts
// =============================================================
export const recalculateUserAnalytics = async (req, res) => {
    try {
        const { userId } = req.params;

        const attempts = await ExamAttempt.find({ user: userId, isCompleted: true })
            .populate('answers.question', 'subject topic difficulty')
            .lean();

        if (attempts.length === 0) {
            return res.status(404).json({ message: 'No completed attempts found for this user.' });
        }

        // Build stats
        const totalTestsTaken = attempts.length;
        const overallAccuracy = Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / totalTestsTaken);
        const averageScore = Math.round(attempts.reduce((s, a) => s + (a.totalScore || 0), 0) / totalTestsTaken);
        const lastTestDate = attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;

        let totalQ = 0, correctQ = 0;
        const subjectMap = {};
        attempts.forEach(attempt => {
            attempt.answers?.forEach(ans => {
                totalQ++;
                if (ans.isCorrect) correctQ++;
                const sub = ans.question?.subject;
                if (sub) {
                    if (!subjectMap[sub]) subjectMap[sub] = { attempted: 0, correct: 0 };
                    subjectMap[sub].attempted++;
                    if (ans.isCorrect) subjectMap[sub].correct++;
                }
            });
        });

        const subjectWiseStats = Object.entries(subjectMap).map(([subject, s]) => ({
            subject,
            questionsAttempted: s.attempted,
            questionsCorrect: s.correct,
            accuracy: Math.round((s.correct / s.attempted) * 100),
            strength: s.correct / s.attempted >= 0.7 ? 'strong' : s.correct / s.attempted >= 0.4 ? 'average' : 'weak',
        }));

        await UserAnalytics.findOneAndUpdate(
            { user: userId },
            {
                user: userId,
                overallStats: {
                    totalTestsTaken,
                    totalQuestionsAttempted: totalQ,
                    totalQuestionsCorrect: correctQ,
                    overallAccuracy,
                    averageScore,
                    lastTestDate,
                },
                subjectWiseStats,
                lastCalculatedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        res.json({ message: 'Analytics recalculated successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
