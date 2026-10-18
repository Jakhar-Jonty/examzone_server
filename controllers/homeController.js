import PracticeSession from '../models/PracticeSession.js';
import { getDashboardStats } from './userController.js';
import { getCurrentWordOfDay, getCurrentMotivationalQuote } from './contentController.js';
import { getAvailableExams, getActiveAttempt } from './examController.js';
import { getPublishedSeries } from './userTestSeriesController.js';
import { getNotifications } from './notificationController.js';
import { getPlans } from './studyPlanController.js';
import { getSessions } from './practiceSessionController.js';
import { getLiveMocks } from './liveMockController.js';
import { getMyProgress } from '../routes/gamification.js';

/**
 * Run an existing route handler in-process and resolve with its JSON body
 * (null on any error or non-2xx), so /home reuses each endpoint's exact logic.
 */
const run = (handler, req, query = {}) =>
  new Promise((resolve) => {
    let status = 200;
    const res = {
      status(code) {
        status = code;
        return res;
      },
      json(body) {
        resolve(status < 300 ? body : null);
        return res;
      },
      send(body) {
        resolve(status < 300 ? body : null);
        return res;
      },
      set() {
        return res;
      },
      setHeader() {
        return res;
      },
    };
    const sub = Object.create(req, { query: { value: query }, params: { value: {} } });
    Promise.resolve(handler(sub, res, () => resolve(null))).catch(() => resolve(null));
  });

/**
 * GET /api/home — everything the app's Home screen needs in one round trip
 * (it used to make 12 separate requests, which phones queue ~5 at a time).
 */
export const getHome = async (req, res) => {
  try {
    const [stats, word, quote, exams, progress, series, active, notifications, practice, plans, liveMock] =
      await Promise.all([
        run(getDashboardStats, req),
        run(getCurrentWordOfDay, req),
        run(getCurrentMotivationalQuote, req),
        run(getAvailableExams, req),
        run(getMyProgress, req),
        run(getPublishedSeries, req, { limit: '6' }),
        run(getActiveAttempt, req),
        run(getNotifications, req, { page: '1', limit: '3' }),
        run(getSessions, req, { limit: '8' }),
        run(getPlans, req),
        run(getLiveMocks, req),
      ]);

    // the unfinished practice session, with how far the student got
    let activePractice = (practice?.sessions || []).find((s) => !s.isCompleted) || null;
    if (activePractice) {
      const [row] = await PracticeSession.aggregate([
        { $match: { _id: activePractice._id } },
        { $project: { n: { $size: { $ifNull: ['$answers', []] } } } },
      ]);
      activePractice = { ...activePractice, answeredCount: row?.n || 0 };
    }

    res.json({
      stats,
      wordOfDay: word?.wordOfDay || word?.word || word,
      quote: quote?.quote || quote?.motivationalQuote || quote,
      exams: exams?.exams || [],
      progress,
      testSeries: series?.series || [],
      activeAttempt: active?.attempt || null,
      unreadCount: notifications?.unreadCount || 0,
      updates: notifications?.notifications || [],
      activePractice,
      studyPlans: plans?.plans || [],
      liveMock,
    });
  } catch (error) {
    console.error('getHome failed:', error);
    res.status(500).json({ message: 'Could not load home.' });
  }
};
