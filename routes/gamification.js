import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import { getStreakInfo } from '../utils/streakManager.js';
import { RANK_THRESHOLDS, PERF_BADGES, rankForXp } from '../utils/awardEngine.js';
import { BADGES as STREAK_BADGES } from '../utils/streakManager.js';

const router = express.Router();

/**
 * GET /api/gamification/leaderboard?limit=50
 * Global leaderboard by XP. Also returns the requesting user's own position
 * so the client can pin a "your rank" row even when off-screen.
 */
export const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const top = await User.find({ role: { $ne: 'admin' } })
      .sort({ xp: -1 })
      .limit(limit)
      .select('name profileImage xp rank currentStreak')
      .lean();

    const leaderboard = top.map((u, i) => ({
      position: i + 1,
      userId: u._id,
      name: u.name,
      profileImage: u.profileImage || null,
      xp: u.xp || 0,
      rank: u.rank || 'Beginner',
      currentStreak: u.currentStreak || 0,
    }));

    // Requesting user's own standing (rank = #users with strictly more XP + 1)
    const me = await User.findById(req.user._id).select('name profileImage xp rank currentStreak').lean();
    let myPosition = null;
    if (me) {
      const ahead = await User.countDocuments({
        role: { $ne: 'admin' },
        xp: { $gt: me.xp || 0 },
      });
      myPosition = {
        position: ahead + 1,
        userId: me._id,
        name: me.name,
        profileImage: me.profileImage || null,
        xp: me.xp || 0,
        rank: me.rank || 'Beginner',
        currentStreak: me.currentStreak || 0,
      };
    }

    res.json({ leaderboard, me: myPosition });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/gamification/me/badges
 * All badges (streak + performance) with earned/locked state and earnedAt.
 */
export const getMyBadges = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('badges').lean();
    const earnedMap = new Map((user?.badges || []).map((b) => [b.badgeId, b.earnedAt]));

    const all = [...Object.values(STREAK_BADGES), ...Object.values(PERF_BADGES)];
    const badges = all.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon || '🏅',
      color: b.color || '#FFD700',
      earned: earnedMap.has(b.id),
      earnedAt: earnedMap.get(b.id) || null,
    }));

    res.json({
      badges,
      earnedCount: badges.filter((b) => b.earned).length,
      total: badges.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/gamification/me/progress
 * XP, rank, and progress toward the next rank — for profile/dashboard chips.
 */
export const getMyProgress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('xp rank').lean();
    const xp = user?.xp || 0;
    const rank = user?.rank || rankForXp(xp);

    const idx = RANK_THRESHOLDS.findIndex((t) => t.rank === rank);
    const next = RANK_THRESHOLDS[idx + 1] || null;
    const floor = RANK_THRESHOLDS[idx]?.min || 0;
    const progressToNext = next
      ? Math.min(1, (xp - floor) / (next.min - floor))
      : 1;

    const streak = await getStreakInfo(req.user._id);

    res.json({
      xp,
      rank,
      nextRank: next?.rank || null,
      xpToNextRank: next ? Math.max(0, next.min - xp) : 0,
      progressToNext,
      streak,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

router.get('/leaderboard', authenticate, getLeaderboard);
router.get('/me/badges', authenticate, getMyBadges);
router.get('/me/progress', authenticate, getMyProgress);

export default router;
