import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';

/**
 * awardEngine — XP, rank, and performance badges.
 *
 * Streak + streak-badges live in streakManager.js (called separately on submit).
 * This module handles everything score-driven: it runs once per completed
 * exam attempt, after the attempt is saved.
 */

// XP thresholds for each rank (must be ascending).
export const RANK_THRESHOLDS = [
  { rank: 'Beginner', min: 0 },
  { rank: 'Learner', min: 500 },
  { rank: 'Skilled', min: 2000 },
  { rank: 'Expert', min: 5000 },
  { rank: 'Master', min: 10000 },
];

// Performance badges (score / volume driven). Streak badges are in streakManager.
export const PERF_BADGES = {
  FIRST_EXAM: { id: 'first_exam', name: 'First Steps', description: 'Complete your first exam', icon: '🎓', color: '#16a34a' },
  PERFECT_SCORE: { id: 'perfect_score', name: 'Flawless', description: 'Score 100% on an exam', icon: '💯', color: '#ef4444' },
  SHARPSHOOTER: { id: 'sharpshooter', name: 'Sharpshooter', description: 'Score 90% or higher', icon: '🏹', color: '#8b5cf6' },
  TEN_EXAMS: { id: 'ten_exams', name: 'Double Digits', description: 'Complete 10 exams', icon: '🔟', color: '#f59e0b' },
  FIFTY_EXAMS: { id: 'fifty_exams', name: 'Half Century', description: 'Complete 50 exams', icon: '🥇', color: '#eab308' },
  HUNDRED_EXAMS: { id: 'hundred_exams', name: 'Centurion of Tests', description: 'Complete 100 exams', icon: '💎', color: '#06b6d4' },
};

// Compute XP earned from a single completed attempt.
export const computeXp = ({ correctAnswers = 0, percentage = 0 }) => {
  const base = correctAnswers * 10;          // reward correct answers
  const accuracyBonus = Math.round(percentage); // up to +100
  const completionBonus = 20;                // showing up counts
  return base + accuracyBonus + completionBonus;
};

// Map an XP total to a rank.
export const rankForXp = (xp) => {
  let current = RANK_THRESHOLDS[0].rank;
  for (const t of RANK_THRESHOLDS) {
    if (xp >= t.min) current = t.rank;
  }
  return current;
};

/**
 * Award XP, recompute rank, and grant performance badges for a completed attempt.
 * Returns a summary used to drive the post-exam celebration on the client.
 */
export const awardForAttempt = async (userId, { correctAnswers, percentage }) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const xpGained = computeXp({ correctAnswers, percentage });
    const prevRank = user.rank;
    user.xp = (user.xp || 0) + xpGained;
    user.rank = rankForXp(user.xp);
    const rankedUp = user.rank !== prevRank;

    // Performance badges
    const completedCount = await ExamAttempt.countDocuments({
      user: userId,
      isCompleted: true,
    });
    const existing = new Set(user.badges.map((b) => b.badgeId));
    const newBadges = [];
    const grant = (badge) => {
      if (!existing.has(badge.id)) {
        user.badges.push({ badgeId: badge.id, badgeName: badge.name, earnedAt: new Date() });
        existing.add(badge.id);
        newBadges.push(badge);
      }
    };

    if (completedCount >= 1) grant(PERF_BADGES.FIRST_EXAM);
    if (completedCount >= 10) grant(PERF_BADGES.TEN_EXAMS);
    if (completedCount >= 50) grant(PERF_BADGES.FIFTY_EXAMS);
    if (completedCount >= 100) grant(PERF_BADGES.HUNDRED_EXAMS);
    if (percentage >= 100) grant(PERF_BADGES.PERFECT_SCORE);
    else if (percentage >= 90) grant(PERF_BADGES.SHARPSHOOTER);

    await user.save();

    // Broadcast leaderboard update via Socket.io (non-blocking).
    try {
      const { getIo } = await import('./socket.js');
      const io = getIo();
      if (io) {
        const top = await User.find({ role: { $ne: 'admin' } })
          .sort({ xp: -1 })
          .limit(50)
          .select('name profileImage xp rank currentStreak')
          .lean();
        io.emit('leaderboard:update', {
          leaderboard: top.map((u, i) => ({
            position: i + 1,
            userId: u._id,
            name: u.name,
            profileImage: u.profileImage || null,
            xp: u.xp || 0,
            rank: u.rank || 'Beginner',
            currentStreak: u.currentStreak || 0,
          })),
        });
      }
    } catch (e) {
      console.error('Socket leaderboard emit failed:', e.message);
    }

    // Fire achievement notifications (in-app + push). Non-blocking on failure.
    try {
      const { notifyUser } = await import('./pushService.js');
      if (rankedUp) {
        await notifyUser(userId, {
          title: 'Rank Up! 🎉',
          message: `You reached ${user.rank}. Keep going!`,
          type: 'rank-update',
          category: 'achievement',
          priority: 'high',
        });
      }
      for (const badge of newBadges) {
        await notifyUser(userId, {
          title: 'New Badge Unlocked! 🏅',
          message: `${badge.name} — ${badge.description}`,
          type: 'achievement',
          category: 'achievement',
          relatedBadge: badge.id,
          icon: badge.icon,
          iconColor: badge.color,
        });
      }
    } catch (e) {
      console.error('Achievement notification failed:', e.message);
    }

    return {
      xpGained,
      totalXp: user.xp,
      rank: user.rank,
      rankedUp,
      newBadges,
    };
  } catch (error) {
    console.error('Error in awardForAttempt:', error);
    return null;
  }
};
