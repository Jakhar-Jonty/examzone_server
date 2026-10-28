import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Abuse limits for login / OTP / sign-up. In-memory counters: fine for the
 * single PM2 process; switch to a shared store if the API ever runs >1 instance.
 *
 * Website traffic reaches us via the Vercel rewrite, so req.ip is a Vercel
 * address shared by many students. When the request carries Vercel's header we
 * key on the student's address (first X-Forwarded-For entry) instead. That
 * header can be faked on direct calls, which is why the per-account and
 * per-destination limits below exist too — they don't depend on the address.
 */
const clientIp = (req) => {
  if (req.get('x-vercel-id')) {
    const first = (req.get('x-forwarded-for') || '').split(',')[0].trim();
    if (first) return first;
  }
  return req.ip;
};
const byIp = (req) => ipKeyGenerator(clientIp(req));

const identifierOf = (req) => {
  const b = req.body || {};
  const raw = b.email || b.phoneNumber || b.identifier || '';
  return String(raw).trim().toLowerCase();
};

const tooMany = (message) => (req, res) => res.status(429).json({ message });

const common = { standardHeaders: 'draft-7', legacyHeaders: false };

/** Password / OTP / Google login attempts per network: 30 per 15 min. */
export const loginIpLimit = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: byIp,
  handler: tooMany('Too many login attempts. Please wait 15 minutes and try again.'),
});

/** Failed logins per account: 10 per 15 min (successful logins don't count). */
export const loginAccountLimit = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `acct:${identifierOf(req) || byIp(req)}`,
  handler: tooMany('Too many wrong attempts for this account. Please wait 15 minutes or reset your password.'),
});

/** OTP / reset emails and SMS sent per network: 10 per hour. */
export const otpSendIpLimit = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: byIp,
  handler: tooMany('Too many codes requested. Please try again in an hour.'),
});

/** OTP / reset messages per email or phone: 6 per hour (on top of the resend cooldown). */
export const otpSendDestinationLimit = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 6,
  keyGenerator: (req) => `dest:${identifierOf(req) || byIp(req)}`,
  handler: tooMany('Too many codes sent to this address. Please try again in an hour.'),
});

/** OTP checks and account creation per network: 30 per 15 min. */
export const otpVerifyIpLimit = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: byIp,
  handler: tooMany('Too many attempts. Please wait 15 minutes and try again.'),
});

/** Question reports per student: 30 per day. */
export const reportLimit = rateLimit({
  ...common,
  windowMs: 24 * 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `user:${req.user?._id || byIp(req)}`,
  handler: tooMany('You have sent a lot of reports today. Thanks — please try again tomorrow.'),
});
