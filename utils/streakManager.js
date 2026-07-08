import User from '../models/User.js';

// Badge definitions.
// icon = emoji, color = hex, threshold = streak days — matching the web
// Achievements page so both clients render the same visuals.
export const BADGES = {
  FIRST_DAY: { id: 'first_day', name: 'Getting Started', description: 'Complete your first day of study', icon: '🎯', color: '#16a34a', threshold: 1 },
  THREE_DAY: { id: 'three_day', name: 'On Fire', description: 'Maintain a 3-day streak', icon: '🔥', color: '#f97316', threshold: 3 },
  SEVEN_DAY: { id: 'seven_day', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '⚔️', color: '#8b5cf6', threshold: 7 },
  FOURTEEN_DAY: { id: 'fourteen_day', name: 'Dedicated', description: 'Maintain a 14-day streak', icon: '💪', color: '#16a34a', threshold: 14 },
  THIRTY_DAY: { id: 'thirty_day', name: 'Consistent', description: 'Maintain a 30-day streak', icon: '⭐', color: '#eab308', threshold: 30 },
  SIXTY_DAY: { id: 'sixty_day', name: 'Unstoppable', description: 'Maintain a 60-day streak', icon: '🚀', color: '#16a34a', threshold: 60 },
  HUNDRED_DAY: { id: 'hundred_day', name: 'Centurion', description: 'Maintain a 100-day streak', icon: '👑', color: '#f59e0b', threshold: 100 },
  TWO_HUNDRED_DAY: { id: 'two_hundred_day', name: 'Legend', description: 'Maintain a 200-day streak', icon: '🏆', color: '#ef4444', threshold: 200 },
  THREE_HUNDRED_DAY: { id: 'three_hundred_day', name: 'Master', description: 'Maintain a 300-day streak', icon: '🎖️', color: '#ec4899', threshold: 300 },
  THREE_SIXTY_FIVE_DAY: { id: 'three_sixty_five_day', name: 'Year Champion', description: 'Maintain a 365-day streak', icon: '🌟', color: '#f59e0b', threshold: 365 }
};

// Helper function to check if two dates are on the same day (in user's timezone)
const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

// Helper function to check if date2 is the day after date1
const isNextDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2 - d1;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
};

// Update user's study streak
export const updateStudyStreak = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If user has never studied before
    if (!user.lastStudyDate) {
      user.currentStreak = 1;
      user.lastStudyDate = today;
      user.totalStudyDays = 1;
      await user.save();
      return { streak: 1, newBadges: await checkAndAwardBadges(user, 1) };
    }

    const lastStudyDate = new Date(user.lastStudyDate);
    lastStudyDate.setHours(0, 0, 0, 0);

    // If already studied today, don't update streak
    if (isSameDay(lastStudyDate, today)) {
      return { streak: user.currentStreak, newBadges: [] };
    }

    // Check if streak should continue or reset
    if (isNextDay(lastStudyDate, today)) {
      // Continue streak
      user.currentStreak += 1;
    } else {
      // Streak broken, reset to 1
      user.currentStreak = 1;
    }

    // Update longest streak if current is longer
    if (user.currentStreak > user.longestStreak) {
      user.longestStreak = user.currentStreak;
    }

    // Update last study date and total study days
    user.lastStudyDate = today;
    user.totalStudyDays += 1;

    await user.save();

    // Check for new badges
    const newBadges = await checkAndAwardBadges(user, user.currentStreak);

    return { 
      streak: user.currentStreak, 
      longestStreak: user.longestStreak,
      totalStudyDays: user.totalStudyDays,
      newBadges 
    };
  } catch (error) {
    console.error('Error updating study streak:', error);
    return null;
  }
};

// Check and award badges based on streak milestones
const checkAndAwardBadges = async (user, currentStreak) => {
  const newBadges = [];
  const existingBadgeIds = user.badges.map(b => b.badgeId);

  // Check streak-based badges
  const streakBadges = [
    { badge: BADGES.FIRST_DAY, threshold: 1 },
    { badge: BADGES.THREE_DAY, threshold: 3 },
    { badge: BADGES.SEVEN_DAY, threshold: 7 },
    { badge: BADGES.FOURTEEN_DAY, threshold: 14 },
    { badge: BADGES.THIRTY_DAY, threshold: 30 },
    { badge: BADGES.SIXTY_DAY, threshold: 60 },
    { badge: BADGES.HUNDRED_DAY, threshold: 100 },
    { badge: BADGES.TWO_HUNDRED_DAY, threshold: 200 },
    { badge: BADGES.THREE_HUNDRED_DAY, threshold: 300 },
    { badge: BADGES.THREE_SIXTY_FIVE_DAY, threshold: 365 }
  ];

  for (const { badge, threshold } of streakBadges) {
    if (currentStreak >= threshold && !existingBadgeIds.includes(badge.id)) {
      user.badges.push({
        badgeId: badge.id,
        badgeName: badge.name,
        earnedAt: new Date()
      });
      newBadges.push(badge);
    }
  }

  if (newBadges.length > 0) {
    await user.save();
  }

  return newBadges;
};

// Get user's streak information
export const getStreakInfo = async (userId) => {
  try {
    const user = await User.findById(userId).select('currentStreak longestStreak lastStudyDate totalStudyDays badges');
    if (!user) return null;

    return {
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      lastStudyDate: user.lastStudyDate,
      totalStudyDays: user.totalStudyDays || 0,
      badges: user.badges || []
    };
  } catch (error) {
    console.error('Error getting streak info:', error);
    return null;
  }
};

