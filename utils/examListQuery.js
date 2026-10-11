import mongoose from 'mongoose';
import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import { deriveDifficultyLabel } from './examListStats.js';

/** Rough server-side difficulty filter (matches deriveDifficultyLabel intent). */
export function applyDifficultyFilter(query, difficulty) {
  if (!difficulty) return;
  switch (difficulty) {
    case 'Hard':
      query['difficultyDistribution.hard'] = { $gte: 35 };
      break;
    case 'Medium':
      query['difficultyDistribution.medium'] = { $gte: 35 };
      break;
    case 'Easy':
      query['difficultyDistribution.easy'] = { $gte: 35 };
      break;
    default:
      break;
  }
}

export function applyPremiumFilter(query, premium) {
  if (premium === 'free') query.isPremium = false;
  else if (premium === 'premium') query.isPremium = true;
}

export async function getUserAttemptExamIds(userId) {
  const attempts = await ExamAttempt.find({ user: userId }).select(
    'exam isCompleted isPaused'
  );
  const completed = [];
  const paused = [];
  for (const a of attempts) {
    const id = a.exam;
    if (a.isCompleted) completed.push(id);
    else if (a.isPaused) paused.push(id);
  }
  return { completed, paused };
}

export async function applyAttemptStatusFilter(query, attemptStatus, userId) {
  if (!attemptStatus || attemptStatus === 'all') return;

  const { completed, paused } = await getUserAttemptExamIds(userId);
  const none = new mongoose.Types.ObjectId();

  if (attemptStatus === 'attempted') {
    query._id = { $in: completed.length ? completed : [none] };
  } else if (attemptStatus === 'paused') {
    query._id = { $in: paused.length ? paused : [none] };
  } else if (attemptStatus === 'available') {
    const exclude = [...new Set([...completed, ...paused].map((id) => id.toString()))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    if (exclude.length) query._id = { ...(query._id || {}), $nin: exclude };
  }
}

export function resolveSortOptions(sortBy, sortOrder) {
  const dir = sortOrder === 'asc' ? 1 : -1;
  if (sortBy === 'popular') {
    return { 'statistics.totalAttempts': -1, scheduledTime: -1 };
  }
  if (sortBy === 'userScore' || sortBy === 'score') {
    return null;
  }
  if (sortBy === 'duration') {
    return { duration: dir, scheduledTime: -1 };
  }
  return { [sortBy === 'title' ? 'title' : 'scheduledTime']: dir };
}

export async function fetchExamsSortedByUserScore(query, userId, page, limit, selectFields) {
  const skip = (page - 1) * limit;
  const userOid =
    userId instanceof mongoose.Types.ObjectId
      ? userId
      : new mongoose.Types.ObjectId(userId);

  const rows = await Exam.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'examattempts',
        let: { examId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$exam', '$$examId'] },
                  { $eq: ['$user', userOid] },
                  { $eq: ['$isCompleted', true] },
                ],
              },
            },
          },
          { $sort: { endTime: -1, createdAt: -1 } },
          { $limit: 1 },
        ],
        as: 'userAttempt',
      },
    },
    {
      $addFields: {
        userLastScore: {
          $ifNull: [{ $arrayElemAt: ['$userAttempt.totalScore', 0] }, -1],
        },
      },
    },
    { $sort: { userLastScore: -1, scheduledTime: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { userAttempt: 0, userLastScore: 0 } },
  ]);

  const total = await Exam.countDocuments(query);
  return { examDocs: rows, total };
}

export async function enrichExamListForUser(examList, userId) {
  if (!examList?.length) return [];

  const { getAttemptStatsByExamIds, enrichExamWithStats } = await import('./examListStats.js');
  const examIds = examList.map((e) => e._id);

  const attempts = await ExamAttempt.find({
    user: userId,
    exam: { $in: examIds },
  }).select('exam isCompleted isPaused _id totalScore percentage endTime createdAt');

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

  const attemptStatsMap = await getAttemptStatsByExamIds(examIds);

  return examList.map((exam) => {
    const attemptInfo = attemptMap[exam._id.toString()];
    return enrichExamWithStats(
      {
        ...exam,
        expiresAt: exam.expiresAt || null,
        questions: exam.totalQuestions || exam.questions || 0,
        isAttempted: attemptInfo?.isCompleted || false,
        isPaused: attemptInfo?.isPaused || false,
        attemptId: attemptInfo?.attemptId || null,
        lastScore: attemptInfo?.lastScore ?? null,
        lastPercentage: attemptInfo?.lastPercentage ?? null,
      },
      attemptStatsMap
    );
  });
}

export async function buildExamHighlights(userId, baseQuery, now = new Date()) {
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const { completed, paused } = await getUserAttemptExamIds(userId);
  const none = new mongoose.Types.ObjectId();

  const selectFields =
    'title duration totalMarks status scheduledTime expiresAt category subCategory tier language difficultyDistribution averageRating reviewCount statistics isPremium publishedAt totalQuestions examType';

  const [newRows, pausedRows, recommendedRows] = await Promise.all([
    Exam.find({
      ...baseQuery,
      publishedAt: { $gte: fortyEightHoursAgo },
    })
      .sort({ publishedAt: -1 })
      .limit(8)
      .populate('category', 'name code displayName')
      .populate('subCategory', 'name code displayName')
      .populate('tier', 'name code')
      .populate('tier', 'name code')
      .select(selectFields)
      .lean(),
    Exam.find({
      ...baseQuery,
      _id: { $in: paused.length ? paused : [none] },
    })
      .sort({ scheduledTime: -1 })
      .limit(8)
      .populate('category', 'name code displayName')
      .populate('subCategory', 'name code displayName')
      .populate('tier', 'name code')
      .select(selectFields)
      .lean(),
    Exam.find({
      ...baseQuery,
      _id: {
        $nin: [...completed, ...paused].map((id) =>
          id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
        ),
      },
    })
      .sort({ 'statistics.totalAttempts': -1, scheduledTime: -1 })
      .limit(8)
      .populate('category', 'name code displayName')
      .populate('subCategory', 'name code displayName')
      .populate('tier', 'name code')
      .select(selectFields)
      .lean(),
  ]);

  return {
    newExams: newRows.map((e) => ({
      ...e,
      difficultyLevel: deriveDifficultyLabel(e.difficultyDistribution),
    })),
    pausedExams: pausedRows.map((e) => ({
      ...e,
      difficultyLevel: deriveDifficultyLabel(e.difficultyDistribution),
    })),
    recommendedExams: recommendedRows.map((e) => ({
      ...e,
      difficultyLevel: deriveDifficultyLabel(e.difficultyDistribution),
    })),
  };
}
