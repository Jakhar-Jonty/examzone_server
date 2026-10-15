import Exam from '../models/Exam.js';
import { ensureUpcomingLiveMock, liveMockSummary, liveLeaderboard, isValidId } from '../utils/liveMock.js';

const notDeleted = { $or: [{ deleted: false }, { deleted: { $exists: false } }] };

// GET /api/live-mock — the current (upcoming / live / just ended) mock + recent history
export const getLiveMocks = async (req, res) => {
  try {
    const now = new Date();
    // live now, else the next upcoming one (created on demand if the weekly job hasn't run yet)
    let current = await Exam.findOne({ isLiveMock: true, ...notDeleted, liveEndsAt: { $gte: now } }).sort({ scheduledTime: 1 });
    if (!current) current = (await ensureUpcomingLiveMock()).exam;

    const past = await Exam.find({ isLiveMock: true, ...notDeleted, liveEndsAt: { $lt: now } })
      .sort({ scheduledTime: -1 })
      .limit(6);

    const [currentSummary, ...history] = await Promise.all([
      current ? liveMockSummary(current, req.user._id, { withBoard: false }) : null,
      ...past.map((e, i) => liveMockSummary(e, req.user._id, { withBoard: i === 0 })),
    ]);
    res.json({ current: currentSummary, lastResult: history[0] || null, history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/live-mock/:id/leaderboard — full ranked list once the window has closed
export const getLeaderboard = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    const exam = await Exam.findOne({ _id: req.params.id, isLiveMock: true });
    if (!exam) return res.status(404).json({ message: 'Not found' });
    const summary = await liveMockSummary(exam, req.user._id, { withBoard: false });
    const board = summary.state === 'ended' ? (await liveLeaderboard(exam)).slice(0, 100) : [];
    res.json({ ...summary, leaderboard: board });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
