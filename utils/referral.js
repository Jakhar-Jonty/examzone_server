// Refer & earn: every student has a code; a friend applies it within a week of
// signing up, and when that friend completes their first exam or practice the
// referrer gets premium days (and the friend a few too). Rewarding on activation,
// not sign-up, keeps throwaway accounts from earning anything.
import User from '../models/User.js';
import { notifyUser } from './pushService.js';

export const REFERRAL = {
  referrerDays: 7,
  friendDays: 3,
  applyWithinDays: 7, // a code can be added up to 7 days after signing up
};

export const webUrl = () => (process.env.WEB_URL || 'https://examprepzone.vercel.app').replace(/\/$/, '');
export const shareUrl = (code) => `${webUrl()}/register?ref=${encodeURIComponent(code)}`;

const L = (user, en, hi) => (user?.preferredLanguage === 'Hindi' ? hi : en);

/** The user's referral code, created on first use (e.g. "JONT4821"). */
export const ensureReferralCode = async (user) => {
  if (user.referralCode) return user.referralCode;
  const prefix = (user.name || 'EXAM').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await User.updateOne({ _id: user._id, referralCode: { $exists: false } }, { $set: { referralCode: code } }).catch((err) => {
      if (err.code === 11000) return null; // code taken — try another
      throw err;
    });
    if (res?.modifiedCount) return code;
    const fresh = await User.findById(user._id).select('referralCode').lean();
    if (fresh?.referralCode) return fresh.referralCode;
  }
  throw new Error('Could not create a referral code. Please try again.');
};

/** Add premium days on top of any remaining premium time. */
export const grantPremiumDays = async (userId, days) => {
  const user = await User.findById(userId).select('subscriptionStatus subscriptionExpiry');
  if (!user) return null;
  const now = new Date();
  const activeUntil =
    user.subscriptionStatus === 'premium' && user.subscriptionExpiry && user.subscriptionExpiry > now ? user.subscriptionExpiry : now;
  // lifetime / admin-granted premium without an expiry stays as it is
  if (user.subscriptionStatus === 'premium' && !user.subscriptionExpiry) return user;
  user.subscriptionStatus = 'premium';
  user.subscriptionExpiry = new Date(activeUntil.getTime() + days * 24 * 3600 * 1000);
  await user.save();
  return user;
};

/** Link a new student to the friend who invited them. */
export const applyReferralCode = async (user, rawCode) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) throw Object.assign(new Error('Enter a referral code.'), { status: 400 });
  if (user.referredBy) throw Object.assign(new Error('A referral code is already applied to your account.'), { status: 400 });
  const ageDays = (Date.now() - new Date(user.createdAt).getTime()) / (24 * 3600 * 1000);
  if (ageDays > REFERRAL.applyWithinDays) {
    throw Object.assign(new Error(`Referral codes can be added within ${REFERRAL.applyWithinDays} days of signing up.`), { status: 400 });
  }
  const referrer = await User.findOne({ referralCode: code }).select('name preferredLanguage');
  if (!referrer) throw Object.assign(new Error('This referral code is not valid.'), { status: 404 });
  if (String(referrer._id) === String(user._id)) throw Object.assign(new Error('You cannot use your own code.'), { status: 400 });

  await User.updateOne({ _id: user._id, referredBy: { $exists: false } }, { $set: { referredBy: referrer._id } });
  notifyUser(referrer._id, {
    title: L(referrer, `🎉 ${user.name || 'A friend'} joined with your code`, `🎉 ${user.name || 'आपका दोस्त'} आपके कोड से जुड़ा`),
    message: L(
      referrer,
      `You get ${REFERRAL.referrerDays} premium days when they finish their first test.`,
      `जैसे ही वह अपना पहला टेस्ट पूरा करेगा, आपको ${REFERRAL.referrerDays} दिन का प्रीमियम मिलेगा।`
    ),
    type: 'promotional',
    category: 'update',
    actionUrl: '/refer',
    data: { screen: 'refer' },
  }).catch(() => {});
  return referrer;
};

/**
 * Call after a student completes an exam or practice session. Rewards the
 * referral once, on the referred student's first completed activity.
 */
export const rewardReferralOnActivity = async (userId) => {
  // claim the reward atomically so two parallel completions can't double-pay
  const friend = await User.findOneAndUpdate(
    { _id: userId, referredBy: { $exists: true, $ne: null }, referralRewardedAt: { $exists: false } },
    { $set: { referralRewardedAt: new Date() } },
    { new: true }
  ).select('name referredBy preferredLanguage');
  if (!friend) return null;

  const referrer = await User.findByIdAndUpdate(friend.referredBy, { $inc: { referralCount: 1 } }, { new: true }).select(
    'name preferredLanguage'
  );
  await grantPremiumDays(friend._id, REFERRAL.friendDays);
  if (referrer) await grantPremiumDays(referrer._id, REFERRAL.referrerDays);

  notifyUser(friend._id, {
    title: L(friend, `🎁 ${REFERRAL.friendDays} premium days unlocked`, `🎁 ${REFERRAL.friendDays} दिन का प्रीमियम मिला`),
    message: L(friend, 'Thanks for joining through a friend — enjoy all tests and material.', 'दोस्त के ज़रिए जुड़ने के लिए धन्यवाद — सभी टेस्ट और मटेरियल का आनंद लें।'),
    type: 'subscription',
    category: 'update',
    actionUrl: '/profile',
  }).catch(() => {});
  if (referrer) {
    notifyUser(referrer._id, {
      title: L(referrer, `🎁 +${REFERRAL.referrerDays} premium days`, `🎁 +${REFERRAL.referrerDays} दिन का प्रीमियम`),
      message: L(
        referrer,
        `${friend.name || 'Your friend'} finished their first test. Invite more friends to earn more.`,
        `${friend.name || 'आपके दोस्त'} ने अपना पहला टेस्ट पूरा किया। और दोस्तों को बुलाएँ, और प्रीमियम पाएँ।`
      ),
      type: 'subscription',
      category: 'update',
      actionUrl: '/refer',
      data: { screen: 'refer' },
    }).catch(() => {});
  }
  return { friend: friend._id, referrer: referrer?._id };
};

/** Premium that has run out goes back to free (run hourly by the scheduler). */
export const expireSubscriptions = async () => {
  const res = await User.updateMany(
    { subscriptionStatus: { $in: ['premium', 'trial'] }, subscriptionExpiry: { $ne: null, $lt: new Date() } },
    { $set: { subscriptionStatus: 'free' } }
  );
  return { expired: res.modifiedCount };
};
