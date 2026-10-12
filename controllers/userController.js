import mongoose from 'mongoose';
import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Exam from '../models/Exam.js';
import Article from '../models/Article.js';
import Question from '../models/Question.js';
import SubjectTopic from '../models/SubjectTopic.js';
import SavedQuestion from '../models/SavedQuestion.js';
import Category from '../models/Category.js';
import UserAnalytics from '../models/UserAnalytics.js';
import PracticeSession from '../models/PracticeSession.js';
import cloudinary from '../config/cloudinary.js';
import { istDayStart } from '../utils/istDay.js';

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
    const {
      name, email, examPreparations, preferredLanguage, profileImage,
      dateOfBirth, gender, state, city, bio, preferences
    } = req.body;

    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (email) user.email = email;
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;
    if (profileImage) user.profileImage = profileImage;

    // Personal details
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (gender) user.gender = gender;
    if (state !== undefined) user.state = state;
    if (city !== undefined) user.city = city;
    if (bio !== undefined) user.bio = bio;

    // Merge preferences (don't overwrite the whole object)
    if (preferences && typeof preferences === 'object') {
      user.preferences = { ...user.preferences.toObject?.() || user.preferences, ...preferences };
    }

    // Normalize examPreparations to new format if provided
    if (examPreparations) {
      const { normalizeExamPreparations } = await import('../utils/examPrepHelper.js');
      user.examPreparations = await normalizeExamPreparations(examPreparations);
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Upload profile image
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Delete old profile image if exists
    const user = await User.findById(req.user._id);
    if (user.profileImage) {
      try {
        const publicId = user.profileImage.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error('Error deleting old profile image:', deleteError);
        // Continue even if deletion fails
      }
    }

    res.json({
      message: 'Profile image uploaded successfully',
      url: req.file.path,
      publicId: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExamHistory = async (req, res) => {
  try {
    const {
      category,
      search = '',
      sortBy = 'date',
      sortOrder = 'desc',
      startDate = '',
      endDate = '',
      page = 1,
      limit = 12
    } = req.query;

    const query = { user: req.user._id, isCompleted: true };

    // Handle category filter - could be string (old) or ObjectId (new)
    let categoryMatch = {};
    if (category) {
      // Check if category is ObjectId format or string
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryMatch = { category: category };
      } else {
        // It's a string, find category by code
        const categoryDoc = await Category.findOne({
          code: category.toUpperCase(),
          isActive: true
        });
        if (categoryDoc) {
          categoryMatch = { category: categoryDoc._id };
        }
      }
    }

    // Build exam query for search and category filter
    const examQuery = {};
    if (Object.keys(categoryMatch).length > 0) {
      examQuery.category = categoryMatch.category;
    }
    if (search) {
      examQuery.title = { $regex: search, $options: 'i' };
    }

    // Find matching exams first
    const matchingExams = await Exam.find(examQuery).select('_id').lean();
    const examIds = matchingExams.map(exam => exam._id);

    // Update query to filter by exam IDs
    if (examIds.length > 0) {
      query.exam = { $in: examIds };
    } else if (search || Object.keys(categoryMatch).length > 0) {
      // No matching exams, return empty result
      return res.json({
        attempts: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalAttempts: 0,
          limit: parseInt(limit)
        }
      });
    }

    // Date range filter
    if (startDate || endDate) {
      query.endTime = {};
      if (startDate) {
        query.endTime.$gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.endTime.$lte = endOfDay;
      }
    }

    // Get total count before pagination
    const total = await ExamAttempt.countDocuments(query);

    // Sort options
    const sortOptions = {};
    switch (sortBy) {
      case 'date':
        sortOptions.endTime = sortOrder === 'asc' ? 1 : -1;
        sortOptions.createdAt = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'score':
        sortOptions.totalScore = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'percentage':
        sortOptions.percentage = sortOrder === 'asc' ? 1 : -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    // Get attempts with pagination
    const attempts = await ExamAttempt.find(query)
      .select('_id totalScore percentage correctAnswers incorrectAnswers unattempted timeTaken attemptNumber endTime createdAt exam')
      .populate({
        path: 'exam',
        select: 'title category scheduledTime totalMarks',
        populate: { path: 'category', select: 'name' },
      })
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({
      attempts: attempts || [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalAttempts: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();

    // Get available exams from last 24 hours only
    // MongoDB stores dates in UTC, comparisons are done in UTC
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Use utility helper to get category IDs from examPreparations
    const { getCategoryIdsFromExamPreparations } = await import('../utils/examPrepHelper.js');
    const categoryIds = await getCategoryIdsFromExamPreparations(user.examPreparations);

    // Build query - handle both old and new category formats
    const categoryQuery = categoryIds.length > 0
      ? { category: { $in: categoryIds } }
      : {}; // If no categories found, return empty (or you could remove this filter)

    const availableExams = await Exam.find({
      ...categoryQuery,
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: {
        $gte: last24Hours, // Within last 24 hours
        $lte: now // Already started (or set to now for immediate availability)
      },
      $and: [
        {
          $or: [
            { deleted: false },
            { deleted: { $exists: false } }
          ]
        },
        {
          $or: [
            { expiresAt: { $gte: now } }, // Has expiration and not expired yet
            { expiresAt: null }, // No expiration set (available indefinitely)
            { expiresAt: { $exists: false } } // expiresAt field doesn't exist
          ]
        }
      ]
    })
      .select('-questions') // Don't populate questions - only need count
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

    // Get question counts for all exams in one query
    const examIdsForCounts = availableExams.map(exam => exam._id);
    const examQuestionCounts = await Exam.find({ _id: { $in: examIdsForCounts } })
      .select('_id questions')
      .lean();

    const questionCountMap = {};
    examQuestionCounts.forEach(exam => {
      questionCountMap[exam._id.toString()] = exam.questions?.length || 0;
    });

    // Add attempt info to exams and include question count
    const examsWithAttempts = availableExams.map(exam => {
      const attemptInfo = attemptMap[exam._id.toString()];
      return {
        ...exam.toObject(),
        questions: questionCountMap[exam._id.toString()] || 0, // Just the count
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

    // Get streak information
    const { getStreakInfo } = await import('../utils/streakManager.js');
    const streakInfo = await getStreakInfo(user._id);

    // Get recent exam results (last 5 attempts)
    let recentAttempts = [];
    try {
      recentAttempts = await ExamAttempt.find({
        user: user._id,
        isCompleted: true,
        endTime: { $exists: true, $ne: null } // Only get attempts with endTime
      })
        .select('_id totalScore percentage correctAnswers incorrectAnswers unattempted timeTaken attemptNumber endTime createdAt exam')
        .populate({
          path: 'exam',
          select: 'title category subCategory tier scheduledTime totalMarks',
          populate: [
            { path: 'category', select: 'name code' },
            { path: 'subCategory', select: 'name code' },
            { path: 'tier', select: 'name code' }
          ],
          match: { deleted: { $ne: true } } // Only include non-deleted exams
        })
        .sort({ endTime: -1, createdAt: -1 })
        .limit(5)
        .lean();

      // Filter out attempts where exam was deleted or not found
      recentAttempts = recentAttempts.filter(attempt => attempt.exam);
    } catch (error) {
      console.error('Error fetching recent exam results:', error);
      recentAttempts = [];
    }

    // Get today's published exams (exams published today)
    let todaysExamsWithAttempts = [];
    try {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const todaysPublishedExams = await Exam.find({
        ...categoryQuery,
        status: { $in: ['scheduled', 'active'] },
        scheduledTime: {
          $gte: startOfToday,
          $lte: endOfToday
        },
        $or: [
          { expiresAt: { $gte: now } },
          { expiresAt: null },
          { expiresAt: { $exists: false } }
        ],
        deleted: { $ne: true }
      })
        .select('_id title category subCategory tier scheduledTime duration totalMarks status')
        .populate('category', 'name code logo')
        .populate('subCategory', 'name code logo')
        .populate('tier', 'name code image')
        .sort({ scheduledTime: -1 })
        .limit(10)
        .lean();

      // Get attempt info for today's exams
      const todaysExamIds = todaysPublishedExams.map(exam => exam._id);
      let todaysAttempts = [];
      if (todaysExamIds.length > 0) {
        todaysAttempts = await ExamAttempt.find({
          user: user._id,
          exam: { $in: todaysExamIds }
        }).select('exam isCompleted isPaused _id').lean();
      }

      const todaysAttemptMap = {};
      todaysAttempts.forEach(attempt => {
        todaysAttemptMap[attempt.exam.toString()] = {
          attemptId: attempt._id,
          isCompleted: attempt.isCompleted,
          isPaused: attempt.isPaused
        };
      });

      todaysExamsWithAttempts = todaysPublishedExams.map(exam => ({
        ...exam,
        isAttempted: todaysAttemptMap[exam._id.toString()]?.isCompleted || false,
        isPaused: todaysAttemptMap[exam._id.toString()]?.isPaused || false,
        attemptId: todaysAttemptMap[exam._id.toString()]?.attemptId || null
      }));
    } catch (error) {
      console.error('Error fetching today\'s published exams:', error);
      todaysExamsWithAttempts = [];
    }

    // Get all active categories with their subcategories
    const allCategories = await Category.find({ isActive: true, parentCategory: null })
      .populate('subCategories')
      .sort({ order: 1 })
      .lean();

    // Get exam and question counts for categories
    const allCategoryIds = allCategories.map(c => c._id);
    const subCategoryIds = allCategories.flatMap(c =>
      (c.subCategories || []).map(sc => sc._id)
    );

    const examCounts = await Exam.aggregate([
      {
        $match: {
          $or: [
            { category: { $in: allCategoryIds } },
            { subCategory: { $in: subCategoryIds } }
          ],
          deleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            category: "$category",
            subCategory: "$subCategory"
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const questionCounts = await Question.aggregate([
      {
        $match: {
          $or: [
            { category: { $in: allCategoryIds } },
            { subCategory: { $in: subCategoryIds } }
          ],
          deleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            category: "$category",
            subCategory: "$subCategory"
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const examCountMap = {};
    examCounts.forEach(item => {
      if (item._id.category && !item._id.subCategory) {
        examCountMap[`cat_${item._id.category}`] = (examCountMap[`cat_${item._id.category}`] || 0) + item.count;
      }
      if (item._id.subCategory) {
        examCountMap[`subcat_${item._id.subCategory}`] = (examCountMap[`subcat_${item._id.subCategory}`] || 0) + item.count;
      }
    });

    const categoryQuestionCountMap = {};
    questionCounts.forEach(item => {
      if (item._id.category && !item._id.subCategory) {
        categoryQuestionCountMap[`cat_${item._id.category}`] = (categoryQuestionCountMap[`cat_${item._id.category}`] || 0) + item.count;
      }
      if (item._id.subCategory) {
        categoryQuestionCountMap[`subcat_${item._id.subCategory}`] = (categoryQuestionCountMap[`subcat_${item._id.subCategory}`] || 0) + item.count;
      }
    });

    const categoriesWithCounts = allCategories.map(category => ({
      ...category,
      examCount: examCountMap[`cat_${category._id}`] || 0,
      questionCount: categoryQuestionCountMap[`cat_${category._id}`] || 0,
      subCategories: (category.subCategories || []).map(sub => ({
        ...sub,
        examCount: examCountMap[`subcat_${sub._id}`] || 0,
        questionCount: categoryQuestionCountMap[`subcat_${sub._id}`] || 0
      }))
    }));

    // Home screen extras: target exam names, upcoming live tests, today's daily quiz.
    const prepIds = (user.examPreparations || [])
      .flatMap((ep) => [ep?.category, ep?.subCategory])
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    const [prepCategories, upcomingExams, dailyQuizSession] = await Promise.all([
      prepIds.length
        ? Category.find({ _id: { $in: prepIds } }).select('name code').lean()
        : [],
      Exam.find({
        ...categoryQuery,
        status: { $in: ['scheduled', 'active'] },
        scheduledTime: { $gt: now },
        $or: [{ deleted: false }, { deleted: { $exists: false } }],
      })
        .select('title category scheduledTime duration totalMarks totalQuestions examType')
        .sort({ scheduledTime: 1 })
        .limit(3)
        .lean(),
      PracticeSession.findOne({
        user: user._id,
        sessionType: 'daily-quiz',
        startTime: { $gte: istDayStart(now) },
      })
        .select('isCompleted totalQuestions correctAnswers accuracy')
        .lean(),
    ]);
    const prepNameById = new Map(prepCategories.map((c) => [c._id.toString(), c.name]));
    const targetExams = (user.examPreparations || [])
      .filter((ep) => ep?.category && prepNameById.has(ep.category.toString()))
      .map((ep) => ({
        category: ep.category,
        subCategory: ep.subCategory || null,
        name: prepNameById.get(ep.subCategory?.toString()) || prepNameById.get(ep.category.toString()),
        isPrimary: !!ep.isPrimary,
      }))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

    res.json({
      targetExams,
      upcomingExams,
      dailyQuiz: dailyQuizSession
        ? {
            sessionId: dailyQuizSession._id,
            isCompleted: dailyQuizSession.isCompleted,
            totalQuestions: dailyQuizSession.totalQuestions,
            correctAnswers: dailyQuizSession.correctAnswers,
            accuracy: dailyQuizSession.accuracy,
          }
        : null,
      availableExams: examsWithAttempts,
      categories: categoriesWithCounts,
      stats: {
        totalAttempts,
        averageScore: averageScore.toFixed(2),
        weeklyExamsRemaining
      },
      recentArticles,
      subscriptionStatus: user.subscriptionStatus,
      streak: streakInfo || {
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
        totalStudyDays: 0,
        badges: []
      },
      recentExamResults: recentAttempts || [],
      todaysPublishedExams: todaysExamsWithAttempts || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllExams = async (req, res) => {
  console.log("getAllExams")
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();
    // console.log("User", user)

    // Get query parameters
    const {
      page = 1,
      limit = 12,
      search = '',
      category = '',
      subCategory = '',
      tier = '',
      startDate = '',
      endDate = '',
      language = '',
      subject = '',
      topic = '',
      sortBy = 'scheduledTime',
      sortOrder = 'desc',
      status = '',
      minimal = 'false',
      attemptStatus = '',
      premium = '',
      difficulty = '',
      includeHighlights = 'false',
    } = req.query;

    const {
      applyDifficultyFilter,
      applyPremiumFilter,
      applyAttemptStatusFilter,
      resolveSortOptions,
      fetchExamsSortedByUserScore,
      buildExamHighlights,
      enrichExamListForUser,
    } = await import('../utils/examListQuery.js');

    // Use utility helper to get category IDs from examPreparations
    const { getCategoryIdsFromExamPreparations } = await import('../utils/examPrepHelper.js');
    const categoryIds = await getCategoryIdsFromExamPreparations(user.examPreparations);

    // Build query
    const query = {
      category: categoryIds.length > 0 ? { $in: categoryIds } : { $in: [] }, // Empty if no categories
      scheduledTime: { $lte: now }, // Already started
      $or: [
        { expiresAt: { $gte: now } },
        { expiresAt: null },
        { expiresAt: { $exists: false } }
      ],
      deleted: { $ne: true }
    };

    // Status filter - default to active/scheduled if not specified
    if (status && status !== '') {
      query.status = status;
    } else {
      query.status = { $in: ['scheduled', 'active'] };
    }

    // Search filter
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Category filter - convert category code/name to ObjectId
    if (category) {
      // Check if category is already an ObjectId
      const mongoose = (await import('mongoose')).default;
      let categoryId = null;

      if (mongoose.Types.ObjectId.isValid(category)) {
        // It's already an ObjectId
        categoryId = new mongoose.Types.ObjectId(category);
      } else {
        // Try to find category by code or name
        const categoryDoc = await Category.findOne({
          $or: [
            { code: category.toUpperCase() },
            { name: { $regex: new RegExp(`^${category}$`, 'i') } }
          ],
          isActive: true
        });

        if (categoryDoc) {
          categoryId = categoryDoc._id;
        }
      }

      if (categoryId) {
        // Only apply filter if user has this category in their examPreparations
        if (categoryIds.some(id => id.toString() === categoryId.toString())) {
          query.category = categoryId;
        }
      }
    }

    // SubCategory filter
    if (subCategory && subCategory !== 'none' && subCategory !== '') {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(subCategory)) {
        query.subCategory = new mongoose.Types.ObjectId(subCategory);
      }
    }

    // Tier filter
    if (tier && tier !== 'none' && tier !== '') {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(tier)) {
        query.tier = new mongoose.Types.ObjectId(tier);
        // When querying by tier, also ensure subCategory matches if provided
        if (subCategory && subCategory !== 'none' && subCategory !== '') {
          if (mongoose.Types.ObjectId.isValid(subCategory)) {
            query.subCategory = new mongoose.Types.ObjectId(subCategory);
          }
        }
      }
    }

    // Date range filter
    if (startDate) {
      query.scheduledTime = { ...query.scheduledTime, $gte: new Date(startDate) };
    }
    if (endDate) {
      query.scheduledTime = {
        ...query.scheduledTime,
        $lte: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1) // End of day
      };
    }

    // Language filter
    if (language && ['Hindi', 'English', 'Both'].includes(language)) {
      query.language = language;
    }

    applyPremiumFilter(query, premium);
    applyDifficultyFilter(query, difficulty);
    await applyAttemptStatusFilter(query, attemptStatus, user._id);

    // Subject and Topic filter - filter exams by questions' subject/topic
    if (subject || topic) {
      const questionQuery = {};
      if (subject) {
        questionQuery.subject = { $regex: subject, $options: 'i' };
      }
      if (topic) {
        questionQuery.topic = { $regex: topic, $options: 'i' };
      }

      // Find questions matching subject/topic
      const matchingQuestions = await Question.find(questionQuery).select('_id');
      const questionIds = matchingQuestions.map(q => q._id);

      // Filter exams that have at least one question matching the criteria
      if (questionIds.length > 0) {
        query.questions = { $in: questionIds };
      } else {
        // No matching questions, return empty result
        query.questions = { $in: [] };
      }
    }

    // Sort options
    const sortOptions = resolveSortOptions(sortBy, sortOrder);
    const useScoreSort = sortBy === 'userScore' || sortBy === 'score';
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Get total count (after attempt/premium/difficulty filters)
    const total = await Exam.countDocuments(query);

    // For minimal fields, only select what's needed
    let selectFields = '';
    if (minimal === 'true') {
      selectFields =
        'title duration totalMarks status scheduledTime expiresAt publishedAt category subCategory tier language difficultyDistribution averageRating reviewCount statistics isPremium accessType totalQuestions examType';
    } else {
      selectFields = '-questions'; // Exclude questions array to avoid loading
    }

    let exams;
    if (useScoreSort) {
      const { examDocs } = await fetchExamsSortedByUserScore(
        query,
        user._id,
        pageNum,
        limitNum,
        selectFields
      );
      const orderedIds = examDocs.map((e) => e._id);
      const fetched = await Exam.find({ _id: { $in: orderedIds } })
        .populate('category', 'name code displayName')
        .populate('subCategory', 'name code displayName')
        .populate('tier', 'name code')
        .select(selectFields);
      const orderMap = Object.fromEntries(
        orderedIds.map((id, i) => [id.toString(), i])
      );
      exams = fetched.sort(
        (a, b) => orderMap[a._id.toString()] - orderMap[b._id.toString()]
      );
    } else {
      const examQuery = Exam.find(query)
        .populate('category', 'name code displayName')
        .populate('subCategory', 'name code displayName')
        .populate('tier', 'name code')
        .select(selectFields)
        .sort(sortOptions || { scheduledTime: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum);

      exams = await examQuery;
    }

    // Get question counts separately (more efficient)
    const examIds = exams.map(exam => exam._id);
    const examQuestionCounts = await Exam.find({ _id: { $in: examIds } })
      .select('_id questions')
      .lean();

    const questionCountMap = {};
    examQuestionCounts.forEach(exam => {
      questionCountMap[exam._id.toString()] = exam.questions?.length || 0;
    });

    // Get attempt information for each exam (latest completed + paused state)
    const attempts = await ExamAttempt.find({
      user: user._id,
      exam: { $in: examIds },
    }).select(
      'exam isCompleted isPaused _id totalScore percentage endTime createdAt'
    );

    const attemptMap = {};
    for (const attempt of attempts) {
      const key = attempt.exam.toString();
      if (!attemptMap[key]) {
        attemptMap[key] = {
          attemptId: null,
          isCompleted: false,
          isPaused: false,
          lastScore: null,
          lastPercentage: null,
          lastAttemptAt: null,
        };
      }
      const entry = attemptMap[key];
      if (attempt.isCompleted) {
        entry.isCompleted = true;
        const at = new Date(attempt.endTime || attempt.createdAt || 0).getTime();
        if (!entry.lastAttemptAt || at >= entry.lastAttemptAt) {
          entry.lastAttemptAt = at;
          entry.attemptId = attempt._id;
          entry.lastScore = attempt.totalScore;
          entry.lastPercentage = attempt.percentage;
        }
      } else if (attempt.isPaused) {
        entry.isPaused = true;
      }
    }

    // Live attempt stats for cards (rating, attempts, top score)
    const { getAttemptStatsByExamIds, enrichExamWithStats } = await import(
      '../utils/examListStats.js'
    );
    const attemptStatsMap = await getAttemptStatsByExamIds(examIds);

    // Add attempt info to exams and include question count
    const examsWithAttempts = exams.map((exam) => {
      const attemptInfo = attemptMap[exam._id.toString()];
      const examObj = exam.toObject();
      const enriched = enrichExamWithStats(
        {
          ...examObj,
          expiresAt: examObj.expiresAt || null,
          questions: questionCountMap[exam._id.toString()] || 0,
          isAttempted: attemptInfo?.isCompleted || false,
          isPaused: attemptInfo?.isPaused || false,
          attemptId: attemptInfo?.attemptId || null,
          lastScore: attemptInfo?.lastScore ?? null,
          lastPercentage: attemptInfo?.lastPercentage ?? null,
        },
        attemptStatsMap
      );
      return enriched;
    });

    let highlightsPayload = null;
    if (includeHighlights === 'true') {
      const raw = await buildExamHighlights(user._id, {
        category: query.category,
        scheduledTime: query.scheduledTime,
        $or: query.$or,
        deleted: query.deleted,
        status: query.status,
      });
      highlightsPayload = {
        newExams: await enrichExamListForUser(raw.newExams, user._id),
        pausedExams: await enrichExamListForUser(raw.pausedExams, user._id),
        recommendedExams: await enrichExamListForUser(raw.recommendedExams, user._id),
      };
    }

    res.json({
      exams: examsWithAttempts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalExams: total,
        limit: limitNum,
      },
      ...(highlightsPayload ? { highlights: highlightsPayload } : {}),
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
      .populate({
        path: 'exam',
        select: 'title category totalMarks',
        populate: { path: 'category', select: 'name' },
      })
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
      // Group by category name (exams have no subject field); never expose raw ids
      const subject = attempt.exam?.category?.name || 'General';
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

    // Weak-topic recommendations for "Start 15 Qs"
    const userAnalytics = await UserAnalytics.findOne({ user }).lean();
    let weakTopics = (userAnalytics?.topicWiseStats || [])
      .filter((t) => t.topic && t.questionsAttempted >= 3 && (t.needsPractice || t.accuracy < 60))
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
      .slice(0, 5);

    if (!weakTopics.length) {
      const topicMap = {};
      const recentAttempts = await ExamAttempt.find({
        user,
        isCompleted: true,
        createdAt: { $gte: startDate },
      })
        .select('answers')
        .sort({ createdAt: -1 })
        .limit(15)
        .populate({
          path: 'answers.question',
          select: 'subject topic',
        })
        .lean();

      recentAttempts.forEach((attempt) => {
        attempt.answers?.forEach((ans) => {
          const q = ans.question;
          if (!q?.topic) return;
          const key = `${q.subject || ''}::${q.topic}`;
          if (!topicMap[key]) {
            topicMap[key] = { subject: q.subject || '', topic: q.topic, attempted: 0, correct: 0 };
          }
          if (ans.selectedAnswer) {
            topicMap[key].attempted += 1;
            if (ans.isCorrect) topicMap[key].correct += 1;
          }
        });
      });

      weakTopics = Object.values(topicMap)
        .filter((t) => t.attempted >= 3)
        .map((t) => ({
          subject: t.subject,
          topic: t.topic,
          accuracy: (t.correct / t.attempted) * 100,
          questionsAttempted: t.attempted,
          needsPractice: true,
        }))
        .filter((t) => t.accuracy < 60)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5);
    }

    const practiceRecommendations = weakTopics.map((t) => ({
      subject: t.subject,
      topic: t.topic,
      accuracy: Number((t.accuracy ?? 0).toFixed(1)),
      questionCount: 15,
      sessionType: 'topic-wise',
      filters: {
        subject: t.subject || undefined,
        topics: [t.topic],
      },
      label: `Start 15 Qs · ${t.topic}`,
    }));

    res.json({
      stats: {
        totalAttempts,
        averageScore,
        bestScore
      },
      overallStats: {
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
      },
      practiceRecommendations,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get subjects and topics for filtering (user-accessible)
export const getSubjectsAndTopics = async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};

    if (category) {
      // Handle both ObjectId and string category
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        // If it's a string (category code), find the category first
        const categoryDoc = await Category.findOne({
          code: category.toUpperCase(),
          isActive: true
        });
        if (categoryDoc) {
          query.category = categoryDoc._id;
        } else {
          // Category not found, return empty result
          return res.json({ subjectsAndTopics: [] });
        }
      }
    }

    const subjectTopics = await SubjectTopic.find(query)
      .populate('category', 'name code')
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(1000);

    // Group by subject
    const grouped = {};
    subjectTopics.forEach(st => {
      const categoryId = st.category?._id?.toString() || st.category?.toString() || '';
      const categoryName = st.category?.name || st.category?.code || categoryId;

      if (!grouped[st.subject]) {
        grouped[st.subject] = {
          subject: st.subject,
          topics: [],
          category: categoryId,
          categoryName: categoryName
        };
      }
      if (st.topic && !grouped[st.subject].topics.includes(st.topic)) {
        grouped[st.subject].topics.push(st.topic);
      }
    });

    // Convert to array and sort topics
    const result = Object.values(grouped).map(item => ({
      ...item,
      topics: item.topics.sort()
    }));

    res.json({ subjectsAndTopics: result });
  } catch (error) {
    console.error('Error fetching subjects and topics:', error);
    res.status(500).json({ message: error.message });
  }
};

// Save a question to user's question bank
export const saveQuestion = async (req, res) => {
  try {
    const { questionId, notes, tags, status } = req.body;
    const userId = req.user._id;

    // Check if question exists
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if already saved
    const existing = await SavedQuestion.findOne({ user: userId, question: questionId });
    if (existing) {
      return res.status(400).json({ message: 'Question already saved' });
    }

    // Save the question
    const savedQuestion = new SavedQuestion({
      user: userId,
      question: questionId,
      notes: notes || '',
      tags: tags || [],
      status: status || 'needs-review'
    });

    await savedQuestion.save();

    // Populate question details
    await savedQuestion.populate('question', 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language difficulty category subject topic');

    res.json({
      message: 'Question saved successfully',
      savedQuestion
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Question already saved' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Unsave a question
export const unsaveQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user._id;

    const deleted = await SavedQuestion.findOneAndDelete({
      user: userId,
      question: questionId
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Saved question not found' });
    }

    res.json({ message: 'Question removed from question bank' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all saved questions for a user
export const getSavedQuestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      subject = '',
      topic = '',
      status = '',
      sortBy = 'savedAt',
      sortOrder = 'desc',
      source = '',
      tag = '',
      revisitOnly = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    // ── SavedQuestion-level match ──
    const savedMatch = { user: new mongoose.Types.ObjectId(userId) };

    if (status && ['needs-review', 'mastered', 'reviewed'].includes(status)) {
      savedMatch.status = status;
    }

    if (source === 'auto') {
      savedMatch.$or = [{ source: 'auto' }, { tags: 'mistake' }];
    } else if (source === 'manual') {
      if (!savedMatch.$and) savedMatch.$and = [];
      savedMatch.$and.push({
        $or: [
          { source: 'manual' },
          { source: { $exists: false } },
          { source: null },
        ],
      });
    }

    if (tag) savedMatch.tags = tag;
    if (revisitOnly === 'true') savedMatch.wrongCount = { $gte: 2 };

    // ── Stats (source-scoped, before question-level filters) ──
    let stats = null;
    if (source === 'auto' || req.query.includeStats === 'true') {
      const base = { user: new mongoose.Types.ObjectId(userId) };
      if (source === 'auto') base.$or = [{ source: 'auto' }, { tags: 'mistake' }];
      else if (source === 'manual') {
        base.$and = [{ $or: [{ source: 'manual' }, { source: { $exists: false } }, { source: null }] }];
      }
      if (tag) base.tags = tag;
      const [total, needsReview, revisit] = await Promise.all([
        SavedQuestion.countDocuments(base),
        SavedQuestion.countDocuments({ ...base, status: 'needs-review' }),
        SavedQuestion.countDocuments({ ...base, wrongCount: { $gte: 2 } }),
      ]);
      stats = { total, needsReview, revisit };
    }

    // ── Question-level match (applied after $lookup) ──
    const questionMatch = {};
    if (category) {
      questionMatch['question.category'] = mongoose.Types.ObjectId.isValid(category)
        ? new mongoose.Types.ObjectId(category)
        : category;
    }
    if (subject) {
      questionMatch['question.subject'] = { $regex: new RegExp(`^${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }
    if (topic) {
      questionMatch['question.topic'] = { $regex: new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: new RegExp(escaped, 'i') };
      questionMatch.$or = [
        { 'question.questionText': regex },
        { 'question.questionTextHindi': regex },
        { notes: regex },
      ];
    }

    const hasQuestionFilters = Object.keys(questionMatch).length > 0;

    // ── Sort ──
    const allowedSort = new Set(['savedAt', 'createdAt', 'updatedAt', 'status', 'wrongCount', 'lastWrongAt']);
    const sortField = allowedSort.has(sortBy) ? sortBy : 'savedAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const questionFields = {
      questionText: 1, questionTextHindi: 1,
      options: 1, optionsHindi: 1,
      correctAnswer: 1, explanation: 1, explanationHindi: 1,
      marks: 1, questionImage: 1, language: 1,
      difficulty: 1, category: 1, subject: 1, topic: 1,
    };

    // ── Aggregation pipeline ──
    const pipeline = [
      { $match: savedMatch },
      {
        $lookup: {
          from: 'questions',
          localField: 'question',
          foreignField: '_id',
          as: 'question',
          pipeline: [{ $project: questionFields }],
        },
      },
      { $unwind: { path: '$question', preserveNullAndEmptyArrays: false } },
    ];

    if (hasQuestionFilters) {
      pipeline.push({ $match: questionMatch });
    }

    // Count total matching before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const [countResult] = await SavedQuestion.aggregate(countPipeline);
    const totalMatching = countResult?.total || 0;

    // Sort + paginate
    pipeline.push(
      { $sort: { [sortField]: sortDir } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
      {
        $project: {
          _id: 1, question: 1, savedAt: 1, notes: 1, tags: 1,
          status: 1, source: 1, wrongCount: 1,
          lastWrongAt: 1, lastWrongAnswer: 1,
          subject: 1, topic: 1,
        },
      },
    );

    const results = await SavedQuestion.aggregate(pipeline);

    res.json({
      savedQuestions: results.map(sq => ({
        _id: sq._id,
        question: sq.question,
        savedAt: sq.savedAt,
        notes: sq.notes,
        tags: sq.tags,
        status: sq.status,
        source: sq.source || 'manual',
        wrongCount: sq.wrongCount || 0,
        lastWrongAt: sq.lastWrongAt,
        lastWrongAnswer: sq.lastWrongAnswer,
        subject: sq.subject,
        topic: sq.topic,
      })),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.max(1, Math.ceil(totalMatching / limitNum)),
        totalQuestions: totalMatching,
        limit: limitNum,
      },
      stats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Batch fetch saved questions for PDF export (Wrong Book scope only)
export const batchGetSavedQuestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    if (ids.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 questions per export' });
    }

    const uniqueIds = [...new Set(ids.map(String))];

    const savedQuestions = await SavedQuestion.find({
      _id: { $in: uniqueIds },
      user: userId,
      $or: [{ source: 'auto' }, { tags: 'mistake' }],
    })
      .populate({
        path: 'question',
        select:
          'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi subject topic difficulty',
      })
      .lean();

    const byId = new Map(savedQuestions.map((sq) => [sq._id.toString(), sq]));
    const ordered = uniqueIds.map((id) => byId.get(id)).filter(Boolean);

    res.json({
      savedQuestions: ordered.map((sq) => ({
        _id: sq._id,
        question: sq.question,
        savedAt: sq.savedAt,
        status: sq.status,
        source: sq.source || 'auto',
        wrongCount: sq.wrongCount || 0,
        lastWrongAt: sq.lastWrongAt,
        subject: sq.subject,
        topic: sq.topic,
      })),
      requested: uniqueIds.length,
      returned: ordered.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update saved question (notes, tags, status)
export const updateSavedQuestion = async (req, res) => {
  try {
    const { savedQuestionId } = req.params;
    const { notes, tags, status } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;
    if (status && ['needs-review', 'mastered', 'reviewed'].includes(status)) {
      updateData.status = status;
    }

    const savedQuestion = await SavedQuestion.findOneAndUpdate(
      { _id: savedQuestionId, user: userId },
      updateData,
      { new: true }
    ).populate('question', 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language difficulty category subject topic');

    if (!savedQuestion) {
      return res.status(404).json({ message: 'Saved question not found' });
    }

    res.json({
      message: 'Saved question updated successfully',
      savedQuestion
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Check if questions are saved (for bulk check)
export const checkSavedQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body; // Array of question IDs
    const userId = req.user._id;

    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ message: 'questionIds must be an array' });
    }

    const savedQuestions = await SavedQuestion.find({
      user: userId,
      question: { $in: questionIds }
    }).select('question');

    const savedQuestionIds = savedQuestions.map(sq => sq.question.toString());

    // Return a map of questionId -> isSaved
    const savedMap = {};
    questionIds.forEach(id => {
      savedMap[id] = savedQuestionIds.includes(id.toString());
    });

    res.json({ savedMap });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

