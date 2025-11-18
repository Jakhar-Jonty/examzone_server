import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Exam from '../models/Exam.js';
import Article from '../models/Article.js';
import Question from '../models/Question.js';
import SubjectTopic from '../models/SubjectTopic.js';
import SavedQuestion from '../models/SavedQuestion.js';

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
      .select('_id totalScore percentage correctAnswers incorrectAnswers unattempted timeTaken attemptNumber endTime createdAt exam')
      .populate({
        path: 'exam',
        match: category ? { category } : {},
        select: 'title category scheduledTime totalMarks'
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

    // Get available exams from last 24 hours only
    // MongoDB stores dates in UTC, comparisons are done in UTC
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const availableExams = await Exam.find({
      category: { $in: user.examPreparations },
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

    res.json({
      availableExams: examsWithAttempts,
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
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllExams = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();
    
    // Get query parameters
    const {
      page = 1,
      limit = 12,
      search = '',
      category = '',
      startDate = '',
      endDate = '',
      language = '',
      subject = '',
      topic = '',
      sortBy = 'scheduledTime',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {
      category: { $in: user.examPreparations },
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: { $lte: now }, // Already started
      $or: [
        { expiresAt: { $gte: now } },
        { expiresAt: null },
        { expiresAt: { $exists: false } }
      ]
    };

    // Search filter
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Category filter
    if (category && user.examPreparations.includes(category)) {
      query.category = category;
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
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await Exam.countDocuments(query);

    // Get exams with pagination - don't populate questions, only need count
    // Explicitly include expiresAt field to ensure it's returned (even if null)
    // Add deleted filter to query
    query.$or = [
      { deleted: false },
      { deleted: { $exists: false } }
    ];
    
    const exams = await Exam.find(query)
      .select('-questions') // Exclude questions array to avoid loading
      .select('+expiresAt') // Explicitly include expiresAt
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get question counts separately (more efficient)
    const examIds = exams.map(exam => exam._id);
    const examQuestionCounts = await Exam.find({ _id: { $in: examIds } })
      .select('_id questions')
      .lean();
    
    const questionCountMap = {};
    examQuestionCounts.forEach(exam => {
      questionCountMap[exam._id.toString()] = exam.questions?.length || 0;
    });

    // Get attempt information for each exam
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

    // Add attempt info to exams and include question count
    const examsWithAttempts = exams.map(exam => {
      const attemptInfo = attemptMap[exam._id.toString()];
      const examObj = exam.toObject();
      return {
        ...examObj,
        expiresAt: examObj.expiresAt || null, // Ensure expiresAt is explicitly set (null if not set)
        questions: questionCountMap[exam._id.toString()] || 0, // Just the count
        isAttempted: attemptInfo?.isCompleted || false,
        isPaused: attemptInfo?.isPaused || false,
        attemptId: attemptInfo?.attemptId || null
      };
    });

    res.json({
      exams: examsWithAttempts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalExams: total,
        limit: parseInt(limit)
      }
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

// Get subjects and topics for filtering (user-accessible)
export const getSubjectsAndTopics = async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    
    if (category) {
      query.category = category;
    }

    const subjectTopics = await SubjectTopic.find(query)
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(1000);

    // Group by subject
    const grouped = {};
    subjectTopics.forEach(st => {
      if (!grouped[st.subject]) {
        grouped[st.subject] = {
          subject: st.subject,
          topics: [],
          category: st.category
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
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { user: userId };

    // Status filter
    if (status && ['needs-review', 'mastered', 'reviewed'].includes(status)) {
      query.status = status;
    }

    // Get saved questions with pagination
    const savedQuestions = await SavedQuestion.find(query)
      .populate({
        path: 'question',
        select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language difficulty category subject topic'
      })
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by category, subject, topic, and search
    let filtered = savedQuestions.filter(sq => {
      const q = sq.question;
      if (!q) return false;

      // Category filter
      if (category && q.category !== category) return false;

      // Subject filter
      if (subject && q.subject?.toLowerCase() !== subject.toLowerCase()) return false;

      // Topic filter
      if (topic && q.topic?.toLowerCase() !== topic.toLowerCase()) return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesText = q.questionText?.toLowerCase().includes(searchLower) ||
                           q.questionTextHindi?.toLowerCase().includes(searchLower) ||
                           sq.notes?.toLowerCase().includes(searchLower);
        if (!matchesText) return false;
      }

      return true;
    });

    // Get total count (after filtering)
    const total = await SavedQuestion.countDocuments({ user: userId });

    res.json({
      savedQuestions: filtered.map(sq => ({
        _id: sq._id,
        question: sq.question,
        savedAt: sq.savedAt,
        notes: sq.notes,
        tags: sq.tags,
        status: sq.status
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalQuestions: total,
        limit: parseInt(limit)
      }
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

