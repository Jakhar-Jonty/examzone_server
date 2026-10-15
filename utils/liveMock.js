// Weekly All-Haryana live mock: one paper for everyone, Sunday 11:00 IST, ranked
// for first attempts submitted inside the live window. Created automatically a
// week ahead (admins can still edit it before it starts).
import mongoose from 'mongoose';
import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import { getFocus } from './focus.js';
import { visibleStatus } from './questionVisibility.js';
import { syncLiveMockSeries } from './liveMockSeries.js';
import { HARYANA_GK_SUBJECT } from './haryanaGk.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const LIVE_MOCK = {
  weekday: 0, // Sunday
  hour: 11, // 11:00 IST
  windowMinutes: 120, // ranked if submitted within 2 hours of the start
  duration: 40, // minutes
  // HSSC CET-style mix; Haryana GK is the differentiator
  mix: {
    [HARYANA_GK_SUBJECT]: 12,
    'General Knowledge': 4,
    Maths: 6,
    Reasoning: 7,
    Hindi: 4,
    English: 4,
    'Computer Science': 3,
  },
  avoidRecentMocks: 4, // don't reuse questions from the last N live mocks
};

/** Next Sunday 11:00 IST strictly after `from` (as a UTC Date). */
export const nextLiveStart = (from = new Date()) => {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay();
  let addDays = (LIVE_MOCK.weekday - day + 7) % 7;
  const candidate = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + addDays, LIVE_MOCK.hour) - IST_OFFSET_MS;
  return new Date(candidate > from.getTime() ? candidate : candidate + 7 * 24 * 3600 * 1000);
};

const istDateLabel = (date) =>
  new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });

/** Current state of a live mock relative to now. */
export const liveState = (exam, now = new Date()) => {
  if (now < exam.scheduledTime) return 'upcoming';
  if (exam.liveEndsAt && now <= exam.liveEndsAt) return 'live';
  return 'ended';
};

export const pickQuestions = async (focus) => {
  const recent = await Exam.find({ isLiveMock: true }).sort({ scheduledTime: -1 }).limit(LIVE_MOCK.avoidRecentMocks).select('questions').lean();
  const used = recent.flatMap((e) => e.questions || []);
  const base = {
    status: visibleStatus(),
    questionType: { $in: ['MCQ', null] },
    ...(focus ? { category: { $in: focus.ids } } : {}),
  };
  const picked = [];
  for (const [subject, n] of Object.entries(LIVE_MOCK.mix)) {
    // fresh questions first, then top up with older ones if the pool is small
    const fresh = await Question.aggregate([
      { $match: { ...base, subject, _id: { $nin: [...used, ...picked] } } },
      { $sample: { size: n } },
      { $project: { _id: 1 } },
    ]);
    picked.push(...fresh.map((q) => q._id));
    if (fresh.length < n) {
      const topUp = await Question.aggregate([
        { $match: { ...base, subject, _id: { $nin: picked } } },
        { $sample: { size: n - fresh.length } },
        { $project: { _id: 1 } },
      ]);
      picked.push(...topUp.map((q) => q._id));
    }
  }
  return picked;
};

/** Make sure next Sunday's live mock exists; returns it (or null when there are no questions). */
export const ensureUpcomingLiveMock = async ({ now = new Date() } = {}) => {
  const start = nextLiveStart(now);
  const existing = await Exam.findOne({ isLiveMock: true, scheduledTime: start, deleted: { $ne: true } });
  if (existing) return { exam: existing, created: false };

  const focus = await getFocus();
  const questions = await pickQuestions(focus);
  if (!questions.length) return { exam: null, created: false };

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  const number = (await Exam.countDocuments({ isLiveMock: true })) + 1;
  const exam = await Exam.create({
    title: `All-Haryana Live Mock #${number} · ${istDateLabel(start)}`,
    description: `Live mock for everyone preparing for ${focus?.name || 'HSSC'}. Same paper, same time — get your Haryana rank when the window closes.`,
    category: focus?.id,
    examType: 'mock',
    scheduledTime: start,
    liveEndsAt: new Date(start.getTime() + LIVE_MOCK.windowMinutes * 60000),
    duration: LIVE_MOCK.duration,
    questions,
    totalQuestions: questions.length,
    totalMarks: questions.length,
    language: 'Both',
    status: 'scheduled',
    isLiveMock: true,
    allowReattempts: true,
    tags: ['live-mock'],
    createdBy: admin?._id,
  });
  await syncLiveMockSeries().catch((err) => console.error('live mock series sync failed:', err.message));
  return { exam, created: true };
};

/** Ranked first attempts (one per student) submitted inside the live window, best first. */
export const liveLeaderboard = async (exam) => {
  const attempts = await ExamAttempt.find({
    exam: exam._id,
    isCompleted: true,
    ...(exam.liveEndsAt ? { endTime: { $lte: exam.liveEndsAt } } : {}),
  })
    .select('user totalScore percentage timeTaken endTime')
    .sort({ endTime: 1 })
    .populate('user', 'name profileImage')
    .lean();
  // re-attempts don't count: keep each student's earliest submission
  const firstByUser = new Map();
  for (const a of attempts) {
    const id = String(a.user?._id || a.user);
    if (!firstByUser.has(id)) firstByUser.set(id, a);
  }
  const ranked = [...firstByUser.values()].sort(
    (a, b) => (b.totalScore || 0) - (a.totalScore || 0) || (a.timeTaken || 0) - (b.timeTaken || 0)
  );
  return ranked.map((a, i) => ({
    rank: i + 1,
    userId: String(a.user?._id || a.user),
    name: a.user?.name || 'Student',
    profileImage: a.user?.profileImage || null,
    score: a.totalScore || 0,
    percentage: a.percentage || 0,
    timeTaken: a.timeTaken || 0,
  }));
};

/** Summary for one live mock from a user's point of view. */
export const liveMockSummary = async (exam, userId, { withBoard = true } = {}) => {
  const state = liveState(exam);
  const board = await liveLeaderboard(exam);
  const mine = board.find((r) => r.userId === String(userId)) || null;
  const myAttempt = mine
    ? null
    : await ExamAttempt.findOne({ exam: exam._id, user: userId }).sort({ createdAt: 1 }).select('isCompleted isPaused').lean();
  return {
    _id: exam._id,
    title: exam.title,
    scheduledTime: exam.scheduledTime,
    liveEndsAt: exam.liveEndsAt,
    duration: exam.duration,
    totalQuestions: exam.totalQuestions || exam.questions?.length || 0,
    totalMarks: exam.totalMarks,
    state,
    participants: board.length,
    me: mine
      ? { attempted: true, ranked: true, rank: mine.rank, score: mine.score, percentage: mine.percentage }
      : { attempted: !!myAttempt, inProgress: !!myAttempt && !myAttempt.isCompleted, ranked: false },
    // ranks are revealed when the window closes
    leaderboard: withBoard && state === 'ended' ? board.slice(0, 20) : [],
  };
};

export const isValidId = (id) => mongoose.isValidObjectId(id);
