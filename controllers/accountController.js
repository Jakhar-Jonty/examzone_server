import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import PracticeSession from '../models/PracticeSession.js';
import SavedQuestion from '../models/SavedQuestion.js';
import StudyPlan from '../models/StudyPlan.js';
import Notification from '../models/Notification.js';
import Review from '../models/Review.js';
import TestSeriesEnrollment from '../models/TestSeriesEnrollment.js';
import UserAnalytics from '../models/UserAnalytics.js';
import UserBadge from '../models/UserBadge.js';
import Leaderboard from '../models/Leaderboard.js';
import OtpToken from '../models/OtpToken.js';

/**
 * DELETE /api/user/account — the signed-in student permanently deletes their
 * account and everything tied to it (required by Google Play). Payment records
 * (Subscription) are kept, as tax law requires, but no longer link to a person.
 * Body: { confirm: 'DELETE' } so a stray request can't wipe an account.
 */
export const deleteAccount = async (req, res) => {
  try {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ message: 'Type DELETE to confirm.' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be deleted from the app.' });
    }

    const id = user._id;
    await Promise.all([
      ExamAttempt.deleteMany({ user: id }),
      PracticeSession.deleteMany({ user: id }),
      SavedQuestion.deleteMany({ user: id }),
      StudyPlan.deleteMany({ user: id }),
      Notification.deleteMany({ user: id }),
      Review.deleteMany({ user: id }),
      TestSeriesEnrollment.deleteMany({ user: id }),
      UserAnalytics.deleteMany({ user: id }),
      UserBadge.deleteMany({ user: id }),
      Leaderboard.updateMany({ 'entries.user': id }, { $pull: { entries: { user: id } } }),
      OtpToken.deleteMany({ destination: { $in: [user.phoneNumber, user.email].filter(Boolean).map((d) => d.toLowerCase()) } }),
    ]);
    await User.deleteOne({ _id: id });

    res.json({ message: 'Your account has been deleted.' });
  } catch (error) {
    console.error('deleteAccount failed:', error);
    res.status(500).json({ message: 'Could not delete the account. Please try again.' });
  }
};
