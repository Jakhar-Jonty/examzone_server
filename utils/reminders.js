import User from '../models/User.js';
import Exam from '../models/Exam.js';
import Notification from '../models/Notification.js';
import PracticeSession from '../models/PracticeSession.js';
import { sendBatchNotifications } from './pushService.js';
import { istDayStart } from './istDay.js';
import { getFocus } from './focus.js';
import { liveLeaderboard } from './liveMock.js';

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

/** Pick the Hindi or English text for this user. */
const L = (user, en, hi) => (user?.preferredLanguage === 'Hindi' ? hi : en);

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
  let users = await User.find(pushableUsers({}, userIds)).select('name pushTokens preferredLanguage').lean();

  const finished = await PracticeSession.distinct('user', {
    sessionType: 'daily-quiz',
    isCompleted: true,
    startTime: { $gte: istDayStart() },
    user: { $in: users.map((u) => u._id) },
  });
  const finishedSet = new Set(finished.map(String));
  users = users.filter((u) => !finishedSet.has(String(u._id)));
  users = await notYetSent(users, groupKey);

  return deliver('daily-quiz', users, (user) => ({
    title: L(user, 'Your daily quiz is ready 🧠', 'आपका डेली क्विज़ तैयार है 🧠'),
    message: L(
      user,
      '10 quick questions for your exam — about 5 minutes. Keep your streak going!',
      'आपकी परीक्षा के 10 छोटे प्रश्न — लगभग 5 मिनट। अपनी स्ट्रीक जारी रखें!'
    ),
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
    .select('name pushTokens currentStreak preferredLanguage')
    .lean();
  users = await notYetSent(users, groupKey);

  return deliver('streak', users, (user) => {
    const days = user.currentStreak || 1;
    return {
      title: L(user, `Your ${days}-day streak ends tonight 🔥`, `आपकी ${days} दिन की स्ट्रीक आज रात खत्म हो जाएगी 🔥`),
      message: L(
        user,
        'Take the daily quiz or one practice session before midnight to keep it.',
        'इसे बचाने के लिए आधी रात से पहले डेली क्विज़ या एक अभ्यास सेशन करें।'
      ),
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
      .select('name pushTokens preferredLanguage')
      .lean();
    users = await notYetSent(users, groupKey);
    const minutes = Math.max(1, Math.round((new Date(exam.scheduledTime) - now) / 60000));

    results.push(
      await deliver(`live-test:${exam.title}`, users, (user) => ({
        title: L(user, `Live test in ${minutes} min ⏰`, `लाइव टेस्ट ${minutes} मिनट में ⏰`),
        message: L(
          user,
          `${exam.title} starts at ${istTime(exam.scheduledTime)}. Tap to get ready.`,
          `${exam.title} ${istTime(exam.scheduledTime)} बजे शुरू होगा। तैयार होने के लिए टैप करें।`
        ),
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

/** Users preparing for the focus exam (everyone when focus mode is off). */
const focusAudience = async () => {
  const focus = await getFocus();
  return focus ? { 'examPreparations.category': { $in: focus.ids } } : {};
};

// Saturday 7 PM — "Tomorrow 11 AM: All-Haryana live mock" for mocks starting within a day.
export const runLiveMockEveReminders = async ({ userIds, dryRun = false } = {}) => {
  const now = new Date();
  const mocks = await Exam.find({
    isLiveMock: true,
    status: { $in: ['scheduled', 'active'] },
    scheduledTime: { $gt: now, $lte: new Date(now.getTime() + 24 * 3600 * 1000) },
    $or: [{ deleted: false }, { deleted: { $exists: false } }],
  })
    .select('title scheduledTime duration totalQuestions')
    .lean();

  const results = [];
  for (const exam of mocks) {
    const groupKey = `live-mock:eve:${exam._id}`;
    let users = await User.find(pushableUsers(await focusAudience(), userIds)).select('name pushTokens preferredLanguage').lean();
    users = await notYetSent(users, groupKey);
    const at = istTime(exam.scheduledTime);
    results.push(
      await deliver(`live-mock-eve:${exam.title}`, users, (user) => ({
        title: L(user, `Tomorrow ${at}: All-Haryana live mock 🏆`, `कल ${at}: ऑल-हरियाणा लाइव मॉक 🏆`),
        message: L(
          user,
          `${exam.totalQuestions || ''} questions, ${exam.duration} min — same paper for everyone. See your Haryana rank when it ends.`.trim(),
          `${exam.totalQuestions || ''} प्रश्न, ${exam.duration} मिनट — सबके लिए एक ही पेपर। खत्म होने पर अपनी हरियाणा रैंक देखें।`.trim()
        ),
        type: 'exam-reminder',
        category: 'exam',
        priority: 'high',
        groupKey,
        relatedExam: exam._id,
        actionUrl: '/live-mock',
        actionText: 'Set a reminder',
        data: { screen: 'live-mock' },
      }), dryRun)
    );
  }
  return { job: 'live-mock-eve', mocks: mocks.length, results };
};

// Every 5 min — once a live window closes: rank to each participant, "results out" to everyone else.
export const runLiveMockResults = async ({ dryRun = false } = {}) => {
  const now = new Date();
  const mocks = await Exam.find({ isLiveMock: true, liveEndsAt: { $lte: now }, liveResultsSentAt: null });

  const results = [];
  for (const exam of mocks) {
    const board = await liveLeaderboard(exam);
    const topper = board[0];
    const rankByUser = new Map(board.map((r) => [r.userId, r]));
    const groupKey = `live-mock:results:${exam._id}`;

    const participants = board.length
      ? await User.find({ _id: { $in: board.map((r) => r.userId) } }).select('name pushTokens preferredLanguage').lean()
      : [];
    let others = await User.find(pushableUsers({ ...(await focusAudience()), _id: { $nin: participants.map((u) => u._id) } }))
      .select('name pushTokens preferredLanguage')
      .lean();
    others = await notYetSent(others, groupKey);
    const pending = await notYetSent(participants, groupKey);

    const base = {
      type: 'rank-update',
      category: 'exam',
      priority: 'high',
      groupKey,
      relatedExam: exam._id,
      actionUrl: '/live-mock',
      data: { screen: 'live-mock', examId: String(exam._id) },
    };
    const rankMsgs = await deliver(`live-mock-ranks:${exam.title}`, pending, (user) => {
      const r = rankByUser.get(String(user._id));
      return {
        ...base,
        title: L(user, `You ranked #${r.rank} of ${board.length} in Haryana 🏆`, `हरियाणा में आपकी रैंक #${r.rank} / ${board.length} 🏆`),
        message: L(
          user,
          `${exam.title}: you scored ${r.score}/${exam.totalMarks}. See the toppers and your answers.`,
          `${exam.title}: आपका स्कोर ${r.score}/${exam.totalMarks}। टॉपर्स और अपने उत्तर देखें।`
        ),
        actionText: 'See leaderboard',
      };
    }, dryRun);
    const outMsgs = board.length
      ? await deliver(`live-mock-out:${exam.title}`, others, (user) => ({
          ...base,
          title: L(user, 'Live mock results are out 📊', 'लाइव मॉक के परिणाम आ गए 📊'),
          message: L(
            user,
            `${board.length} students took ${exam.title}. Topper scored ${topper.score}/${exam.totalMarks}. Join next Sunday!`,
            `${board.length} छात्रों ने ${exam.title} दिया। टॉपर का स्कोर ${topper.score}/${exam.totalMarks}। अगले रविवार ज़रूर जुड़ें!`
          ),
          actionText: 'See toppers',
        }), dryRun)
      : null;

    if (!dryRun) {
      exam.liveResultsSentAt = now;
      await exam.save();
    }
    results.push({ exam: exam.title, participants: board.length, ranks: rankMsgs, others: outMsgs });
  }
  return { job: 'live-mock-results', mocks: mocks.length, results };
};

// On publish — "Today's Haryana current affairs" (once per user per day, however many items get published).
export const notifyCurrentAffairsPublished = async (ca, { userIds, dryRun = false } = {}) => {
  const groupKey = `current-affairs:${ca.date}`;
  let users = await User.find(pushableUsers(await focusAudience(), userIds)).select('name pushTokens preferredLanguage').lean();
  users = await notYetSent(users, groupKey);
  const mcqs = ca.questions?.length || 0;
  return deliver('current-affairs', users, (user) => ({
    title: L(user, "📰 Today's Haryana current affairs", '📰 आज के हरियाणा करंट अफेयर्स'),
    message: L(user, ca.title || ca.titleHindi, ca.titleHindi || ca.title) + (mcqs ? L(user, ` · ${mcqs} MCQs`, ` · ${mcqs} प्रश्न`) : ''),
    type: 'new-content',
    category: 'update',
    priority: 'medium',
    groupKey,
    actionUrl: `/current-affairs/${ca._id}`,
    actionText: 'Read',
    data: { screen: 'current-affair', id: String(ca._id) },
  }), dryRun);
};

export const REMINDER_JOBS = {
  'daily-quiz': runDailyQuizReminders,
  streak: runStreakReminders,
  'live-tests': runLiveTestReminders,
  'live-mock-eve': runLiveMockEveReminders,
  'live-mock-results': runLiveMockResults,
};
