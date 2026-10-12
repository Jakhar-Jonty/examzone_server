import User from '../models/User.js';
import Exam from '../models/Exam.js';
import Notification from '../models/Notification.js';
import PracticeSession from '../models/PracticeSession.js';
import { sendBatchNotifications } from './pushService.js';
import { istDayStart } from './istDay.js';

/**
 * Scheduled push reminders. Each job:
 *  - targets only users who can receive push and haven't turned it off,
 *  - sends at most once per user per reminder (dedupe via Notification.groupKey),
 *  - supports { userIds, dryRun } for manual testing (scripts/runReminders.js).
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LIVE_TEST_WINDOW_MIN = 30;

const pushableUsers = (extra = {}, userIds) => ({
  'pushTokens.0': { $exists: true },
  isActive: { $ne: false },
  isBanned: { $ne: true },
  'preferences.notificationsEnabled': { $ne: false },
  'preferences.pushNotifications': { $ne: false },
  ...(userIds?.length ? { _id: { $in: userIds } } : {}),
  ...extra,
});

/** IST calendar date, e.g. "2026-10-13". */
const istDateKey = (date = new Date()) =>
  new Date(istDayStart(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const istTime = (date) =>
  new Date(date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

/** Drop users who already got this reminder (same groupKey). */
const notYetSent = async (users, groupKey) => {
  if (!users.length) return users;
  const sent = await Notification.distinct('user', { groupKey, user: { $in: users.map((u) => u._id) } });
  const sentSet = new Set(sent.map(String));
  return users.filter((u) => !sentSet.has(String(u._id)));
};

const deliver = async (job, users, buildPayload, dryRun) => {
  const items = users.map((user) => ({ user, payload: buildPayload(user) }));
  if (dryRun) {
    return { job, recipients: items.length, dryRun: true, sample: items[0]?.payload || null };
  }
  const result = await sendBatchNotifications(items);
  return { job, recipients: items.length, ...result };
};

// 8:00 AM — "Your daily quiz is ready" to everyone who hasn't finished today's quiz.
export const runDailyQuizReminders = async ({ userIds, dryRun = false } = {}) => {
  const groupKey = `reminder:daily-quiz:${istDateKey()}`;
  let users = await User.find(pushableUsers({}, userIds)).select('name pushTokens').lean();

  const finished = await PracticeSession.distinct('user', {
    sessionType: 'daily-quiz',
    isCompleted: true,
    startTime: { $gte: istDayStart() },
    user: { $in: users.map((u) => u._id) },
  });
  const finishedSet = new Set(finished.map(String));
  users = users.filter((u) => !finishedSet.has(String(u._id)));
  users = await notYetSent(users, groupKey);

  return deliver('daily-quiz', users, () => ({
    title: 'Your daily quiz is ready 🧠',
    message: '10 quick questions for your exam — about 5 minutes. Keep your streak going!',
    type: 'streak-reminder',
    category: 'reminder',
    priority: 'medium',
    groupKey,
    actionUrl: '/dashboard',
    actionText: 'Start quiz',
    data: { screen: 'daily-quiz' },
  }), dryRun);
};

// 8:00 PM — "Your N-day streak ends tonight" to users with a streak who haven't studied today.
export const runStreakReminders = async ({ userIds, dryRun = false } = {}) => {
  const groupKey = `reminder:streak:${istDateKey()}`;
  let users = await User.find(
    pushableUsers({ currentStreak: { $gte: 1 }, lastStudyDate: { $lt: istDayStart() } }, userIds)
  )
    .select('name pushTokens currentStreak')
    .lean();
  users = await notYetSent(users, groupKey);

  return deliver('streak', users, (user) => {
    const days = user.currentStreak || 1;
    return {
      title: `Your ${days}-day streak ends tonight 🔥`,
      message: 'Take the daily quiz or one practice session before midnight to keep it.',
      type: 'streak-reminder',
      category: 'reminder',
      priority: 'high',
      groupKey,
      actionUrl: '/dashboard',
      actionText: 'Keep my streak',
      data: { screen: 'daily-quiz' },
    };
  }, dryRun);
};

// Every 5 min — "Live test starts in N min" for tests starting within 30 min,
// to users preparing for that exam's category. One reminder per user per test.
export const runLiveTestReminders = async ({ userIds, dryRun = false } = {}) => {
  const now = new Date();
  const exams = await Exam.find({
    status: { $in: ['scheduled', 'active'] },
    scheduledTime: { $gt: now, $lte: new Date(now.getTime() + LIVE_TEST_WINDOW_MIN * 60000) },
    $or: [{ deleted: false }, { deleted: { $exists: false } }],
  })
    .select('title category scheduledTime duration')
    .lean();

  const results = [];
  for (const exam of exams) {
    const groupKey = `reminder:live-test:${exam._id}`;
    let users = await User.find(pushableUsers({ 'examPreparations.category': exam.category }, userIds))
      .select('name pushTokens')
      .lean();
    users = await notYetSent(users, groupKey);
    const minutes = Math.max(1, Math.round((new Date(exam.scheduledTime) - now) / 60000));

    results.push(
      await deliver(`live-test:${exam.title}`, users, () => ({
        title: `Live test in ${minutes} min ⏰`,
        message: `${exam.title} starts at ${istTime(exam.scheduledTime)}. Tap to get ready.`,
        type: 'exam-reminder',
        category: 'exam',
        priority: 'high',
        groupKey,
        relatedExam: exam._id,
        actionUrl: `/exam/${exam._id}`,
        actionText: 'Open test',
        data: { screen: 'exam', examId: String(exam._id) },
      }), dryRun)
    );
  }
  return { job: 'live-tests', tests: exams.length, results };
};

export const REMINDER_JOBS = {
  'daily-quiz': runDailyQuizReminders,
  streak: runStreakReminders,
  'live-tests': runLiveTestReminders,
};
