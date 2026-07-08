import mongoose from 'mongoose';
import PracticeSession from '../models/PracticeSession.js';
import Question from '../models/Question.js';
import ExamAttempt from '../models/ExamAttempt.js';
import UserAnalytics from '../models/UserAnalytics.js';

const DIFFICULTY_GROUPS = {
  Easy: ['Easy', 'VeryEasy'],
  Medium: ['Medium'],
  Hard: ['Hard', 'VeryHard'],
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function castCategoryId(category) {
  if (!category) return null;
  if (mongoose.Types.ObjectId.isValid(category)) {
    return new mongoose.Types.ObjectId(category);
  }
  return category;
}

/** Build a MongoDB match object safe for aggregation ($match does not auto-cast). */
function buildMatchQuery(filters = {}) {
  const query = {};

  const categoryId = castCategoryId(filters.category);
  if (categoryId) query.category = categoryId;

  if (filters.subject?.trim()) {
    query.subject = { $regex: new RegExp(`^${escapeRegex(filters.subject.trim())}$`, 'i') };
  }

  if (filters.topics?.length) {
    const topicRegexes = filters.topics
      .filter(Boolean)
      .map((t) => ({ topic: { $regex: new RegExp(`^${escapeRegex(String(t).trim())}$`, 'i') } }));
    if (topicRegexes.length === 1) {
      query.topic = topicRegexes[0].topic;
    } else if (topicRegexes.length > 1) {
      query.$or = topicRegexes;
    }
  }

  if (filters.difficulty?.length) {
    const expanded = [...new Set(
      filters.difficulty.flatMap((d) => DIFFICULTY_GROUPS[d] || [d])
    )];
    query.difficulty = { $in: expanded };
  }

  if (filters.isPYQ !== undefined) query.isPYQ = filters.isPYQ;

  // Exclude only clearly unusable questions
  query.status = { $nin: ['Archived', 'Flagged'] };

  return query;
}

async function sampleQuestionIds(matchQuery, count) {
  const total = await Question.countDocuments(matchQuery);
  if (!total) return [];

  const sampleSize = Math.min(count, total);
  return Question.aggregate([
    { $match: matchQuery },
    { $sample: { size: sampleSize } },
    { $project: { _id: 1 } },
  ]);
}

/** Relax filters step-by-step until we find questions. */
async function findQuestionsWithFallback(baseQuery, count) {
  const attempts = [
    baseQuery,
    (() => { const q = { ...baseQuery }; delete q.topic; delete q.$or; return q; })(),
    (() => { const q = { ...baseQuery }; delete q.topic; delete q.$or; delete q.subject; return q; })(),
    (() => { const q = { ...baseQuery }; delete q.topic; delete q.$or; delete q.subject; delete q.category; return q; })(),
    { status: { $nin: ['Archived', 'Flagged'] } },
  ];

  const seen = new Set();
  for (const query of attempts) {
    const key = JSON.stringify(query);
    if (seen.has(key)) continue;
    seen.add(key);

    const questions = await sampleQuestionIds(query, count);
    if (questions.length) return { questions, usedQuery: query };
  }

  return { questions: [], usedQuery: baseQuery };
}

async function buildWeakAreasQuery(userId, filters = {}) {
  const query = {};
  const categoryId = castCategoryId(filters.category);
  if (categoryId) query.category = categoryId;

  if (filters.subject?.trim()) {
    query.subject = { $regex: new RegExp(`^${escapeRegex(filters.subject.trim())}$`, 'i') };
  }

  const wrongQuestionIds = new Set();

  const attempts = await ExamAttempt.find({ user: userId, isCompleted: true })
    .select('answers')
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  attempts.forEach((attempt) => {
    attempt.answers?.forEach((ans) => {
      if (ans.isCorrect === false && ans.question) {
        wrongQuestionIds.add(ans.question.toString());
      }
    });
  });

  const practiceSessions = await PracticeSession.find({ user: userId, isCompleted: true })
    .select('answers')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  practiceSessions.forEach((session) => {
    session.answers?.forEach((ans) => {
      if (ans.isCorrect === false && ans.question) {
        wrongQuestionIds.add(ans.question.toString());
      }
    });
  });

  if (wrongQuestionIds.size > 0) {
    const wrongQs = await Question.find({ _id: { $in: [...wrongQuestionIds] } })
      .select('subject topic')
      .lean();
    const topics = [...new Set(wrongQs.map((q) => q.topic).filter(Boolean))];
    const subjects = [...new Set(wrongQs.map((q) => q.subject).filter(Boolean))];
    if (topics.length) {
      query.$or = topics.map((t) => ({
        topic: { $regex: new RegExp(`^${escapeRegex(t)}$`, 'i') },
      }));
    } else if (subjects.length) {
      query.$or = subjects.map((s) => ({
        subject: { $regex: new RegExp(`^${escapeRegex(s)}$`, 'i') },
      }));
    }
  }

  if (!query.$or) {
    const analytics = await UserAnalytics.findOne({ user: userId }).lean();
    const weakTopics = (analytics?.topicWiseStats || [])
      .filter((t) => t.needsPractice || (t.accuracy != null && t.accuracy < 60))
      .map((t) => t.topic)
      .filter(Boolean);
    if (weakTopics.length) {
      query.$or = weakTopics.map((t) => ({
        topic: { $regex: new RegExp(`^${escapeRegex(t)}$`, 'i') },
      }));
    } else {
      const weakSubjects = (analytics?.subjectWiseStats || [])
        .filter((s) => s.strength === 'weak' || (s.accuracy != null && s.accuracy < 60))
        .map((s) => s.subject)
        .filter(Boolean);
      if (weakSubjects.length) {
        query.$or = weakSubjects.map((s) => ({
          subject: { $regex: new RegExp(`^${escapeRegex(s)}$`, 'i') },
        }));
      }
    }
  }

  query.status = { $nin: ['Archived', 'Flagged'] };
  return query;
}

async function buildQuestionQuery(sessionType, filters, userId) {
  if (sessionType === 'subject-wise' && !filters.subject?.trim()) {
    return { error: 'Select a subject for subject-wise practice' };
  }
  if (sessionType === 'topic-wise' && !filters.topics?.length) {
    return { error: 'Select at least one topic for topic-wise practice' };
  }
  if (sessionType === 'difficulty-based' && !filters.difficulty?.length) {
    return { error: 'Select at least one difficulty level' };
  }

  if (sessionType === 'weak-areas') {
    return await buildWeakAreasQuery(userId, filters);
  }

  return buildMatchQuery(filters);
}

export const getSessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      PracticeSession.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-answers')
        .lean(),
      PracticeSession.countDocuments({ user: req.user._id }),
    ]);

    res.json({ sessions, total, page, hasMore: skip + sessions.length < total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getSession = async (req, res) => {
  try {
    const session = await PracticeSession.findOne({ _id: req.params.id, user: req.user._id })
      .populate('questions', 'questionText questionTextHindi options optionsHindi correctAnswer explanation difficulty marks subject topic')
      .lean();
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createSession = async (req, res) => {
  try {
    const { sessionType, filters = {}, questionCount = 20 } = req.body;

    if (!sessionType) return res.status(400).json({ message: 'sessionType is required' });

    const query = await buildQuestionQuery(sessionType, filters, req.user._id);
    if (query.error) return res.status(400).json({ message: query.error });

    const count = Math.min(100, Math.max(5, parseInt(questionCount, 10) || 20));
    const { questions } = await findQuestionsWithFallback(query, count);

    if (!questions.length) {
      const totalInDb = await Question.countDocuments({
        status: { $nin: ['Archived', 'Flagged'] },
      });
      return res.status(404).json({
        message: totalInDb === 0
          ? 'No questions in the question bank yet. Add questions from the admin panel first.'
          : sessionType === 'weak-areas'
          ? 'Not enough data for weak-area practice yet. Take a few exams first, or try Random practice.'
          : 'No questions found for given filters. Try removing the category filter or using Random practice.',
      });
    }

    const session = await PracticeSession.create({
      user: req.user._id,
      sessionType,
      filters,
      questions: questions.map((q) => q._id),
      totalQuestions: questions.length,
      startTime: new Date(),
    });

    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const saveAnswer = async (req, res) => {
  try {
    const { questionId, selectedAnswer, timeSpent = 0 } = req.body;
    const session = await PracticeSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.isCompleted) return res.status(400).json({ message: 'Session already completed' });

    const question = await Question.findById(questionId).select('correctAnswer marks').lean();
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const isCorrect = selectedAnswer ? question.correctAnswer === selectedAnswer : false;

    const existing = session.answers.find((a) => a.question?.toString() === questionId);
    if (existing) {
      existing.selectedAnswer = selectedAnswer;
      existing.isCorrect = isCorrect;
      existing.timeSpent = timeSpent;
    } else {
      session.answers.push({ question: questionId, selectedAnswer, isCorrect, timeSpent });
    }

    await session.save();
    res.json({ isCorrect, correctAnswer: question.correctAnswer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const completeSession = async (req, res) => {
  try {
    const session = await PracticeSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.isCompleted) return res.status(400).json({ message: 'Already completed' });

    const correct = session.answers.filter((a) => a.isCorrect).length;
    const incorrect = session.answers.filter((a) => !a.isCorrect && a.selectedAnswer).length;
    const skipped = session.totalQuestions - correct - incorrect;
    const totalTime = session.answers.reduce((acc, a) => acc + (a.timeSpent || 0), 0);

    session.correctAnswers = correct;
    session.incorrectAnswers = incorrect;
    session.skipped = skipped;
    session.accuracy = session.totalQuestions ? Math.round((correct / session.totalQuestions) * 100) : 0;
    session.totalTime = totalTime;
    session.averageTimePerQuestion = session.answers.length ? Math.round(totalTime / session.answers.length) : 0;
    session.endTime = new Date();
    session.isCompleted = true;

    await session.save();
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getStats = async (req, res) => {
  try {
    const sessions = await PracticeSession.find({ user: req.user._id, isCompleted: true }).lean();

    const totalSessions = sessions.length;
    const totalQuestions = sessions.reduce((acc, s) => acc + s.totalQuestions, 0);
    const totalCorrect = sessions.reduce((acc, s) => acc + s.correctAnswers, 0);
    const avgAccuracy = totalSessions
      ? Math.round(sessions.reduce((acc, s) => acc + s.accuracy, 0) / totalSessions)
      : 0;

    const byType = sessions.reduce((acc, s) => {
      acc[s.sessionType] = (acc[s.sessionType] || 0) + 1;
      return acc;
    }, {});

    res.json({ totalSessions, totalQuestions, totalCorrect, avgAccuracy, byType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
