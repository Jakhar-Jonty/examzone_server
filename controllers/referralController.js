import User from '../models/User.js';
import { REFERRAL, ensureReferralCode, applyReferralCode, shareUrl } from '../utils/referral.js';

const sendError = (res, err) => res.status(err.status || 500).json({ message: err.message });

// GET /api/referral — my code, share link and progress
export const getMyReferral = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('name referralCode referralCount referredBy createdAt');
    const code = await ensureReferralCode(user);
    const joined = await User.countDocuments({ referredBy: user._id });
    const canApply =
      !user.referredBy && (Date.now() - new Date(user.createdAt).getTime()) / (24 * 3600 * 1000) <= REFERRAL.applyWithinDays;
    res.json({
      code,
      shareUrl: shareUrl(code),
      joined,
      activated: user.referralCount || 0,
      daysEarned: (user.referralCount || 0) * REFERRAL.referrerDays,
      rewards: { referrerDays: REFERRAL.referrerDays, friendDays: REFERRAL.friendDays },
      canApply,
      referred: !!user.referredBy,
    });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/referral/apply { code } — a new student enters a friend's code
export const applyCode = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('name referredBy createdAt');
    const referrer = await applyReferralCode(user, req.body?.code);
    res.json({ message: `Code applied — you and ${referrer.name || 'your friend'} get premium days after your first test.` });
  } catch (err) {
    sendError(res, err);
  }
};
