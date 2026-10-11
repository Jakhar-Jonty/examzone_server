import crypto from 'crypto';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import OtpToken from '../models/OtpToken.js';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10) * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashCode = (code) =>
  crypto.createHash('sha256').update(String(code)).digest('hex');

const normalizeDestination = (channel, phoneNumber, email) => {
  if (channel === 'email') {
    const value = (email || '').trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error('Valid email is required');
    }
    return value;
  }
  const value = String(phoneNumber || '').replace(/\s+/g, '').trim();
  if (!value || value.length < 10) {
    throw new Error('Valid phone number is required');
  }
  return value;
};

const generateCode = () =>
  String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

const getTwilioFromNumber = () =>
  process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '';

/**
 * Twilio auth:
 * - Classic: TWILIO_ACCOUNT_SID=ACxxxx + TWILIO_AUTH_TOKEN
 * - API Key: TWILIO_ACCOUNT_SID=ACxxxx + TWILIO_API_KEY_SID=SKxxxx + TWILIO_CLIENT_SECRET (or TWILIO_API_KEY_SECRET)
 *   (If you put SKxxxx in TWILIO_ACCOUNT_SID by mistake, set TWILIO_ACCOUNT_SID to ACxxxx and
 *    TWILIO_API_KEY_SID to the SK value.)
 */
const resolveTwilioCredentials = () => {
  const from = getTwilioFromNumber();
  let accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  let apiKeySid = (process.env.TWILIO_API_KEY_SID || '').trim();
  const apiKeySecret = (
    process.env.TWILIO_API_KEY_SECRET ||
    process.env.TWILIO_CLIENT_SECRET ||
    ''
  ).trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();

  // User put API Key SID in TWILIO_ACCOUNT_SID
  if (accountSid.startsWith('SK') && !apiKeySid) {
    apiKeySid = accountSid;
    accountSid = (process.env.TWILIO_PARENT_ACCOUNT_SID || '').trim();
  }

  return { accountSid, apiKeySid, apiKeySecret, authToken, from };
};

const isTwilioConfigured = () => {
  const { accountSid, apiKeySid, apiKeySecret, authToken, from } = resolveTwilioCredentials();
  if (!from || from.includes('1234567890')) return false;
  if (accountSid.startsWith('AC') && authToken) return true;
  if (accountSid.startsWith('AC') && apiKeySid.startsWith('SK') && apiKeySecret) return true;
  return false;
};

const createTwilioClient = () => {
  const { accountSid, apiKeySid, apiKeySecret, authToken, from } = resolveTwilioCredentials();
  if (!from || from.includes('1234567890')) {
    throw new Error(
      'Set TWILIO_PHONE_NUMBER (or TWILIO_FROM_NUMBER) to your real Twilio number, e.g. +1…'
    );
  }
  if (!accountSid.startsWith('AC')) {
    throw new Error(
      'TWILIO_ACCOUNT_SID must be your Account SID starting with AC (Console → Account Info). ' +
        'If you have an API Key (SK…), put that in TWILIO_API_KEY_SID and the secret in TWILIO_CLIENT_SECRET.'
    );
  }
  if (apiKeySid.startsWith('SK') && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  if (authToken) {
    return twilio(accountSid, authToken);
  }
  throw new Error('Twilio auth incomplete: need TWILIO_AUTH_TOKEN or API key SID + CLIENT_SECRET');
};

const isSmtpConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);

const useMock = (channel) => {
  if (process.env.OTP_MOCK === 'true') return true;
  if (process.env.OTP_MOCK === 'false') return false;
  // Auto-mock only when the chosen channel has no credentials
  if (channel === 'email') return !isSmtpConfigured();
  return !isTwilioConfigured();
};

async function sendSms(to, code) {
  const client = createTwilioClient();
  const from = getTwilioFromNumber();
  const toE164 = to.startsWith('+') ? to : `+91${to.replace(/^0+/, '')}`;
  await client.messages.create({
    body: `Your ExamZone OTP is ${code}. Valid for ${Math.round(OTP_EXPIRY_MS / 60000)} minutes.`,
    from,
    to: toE164,
  });
}

async function sendEmail(to, code) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM)');
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const appName = process.env.APP_NAME || 'ExamZone';
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${appName} OTP: ${code}`,
    text: `Your ${appName} OTP is ${code}. It expires in ${Math.round(OTP_EXPIRY_MS / 60000)} minutes.`,
    html: `<p>Your <strong>${appName}</strong> OTP is <strong style="font-size:18px;letter-spacing:2px">${code}</strong>.</p>
           <p>It expires in ${Math.round(OTP_EXPIRY_MS / 60000)} minutes. If you did not request this, ignore this email.</p>`,
  });
}

/**
 * Send OTP via SMS (Twilio) or email (Nodemailer).
 * @param {{ channel?: 'sms'|'email', phoneNumber?: string, email?: string }} opts
 */
export const sendOTP = async ({ channel = 'sms', phoneNumber, email } = {}) => {
  const dest = normalizeDestination(channel, phoneNumber, email);

  const recent = await OtpToken.findOne({ destination: dest, channel }).sort({ createdAt: -1 });
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - new Date(recent.createdAt).getTime())) / 1000
    );
    throw new Error(`Please wait ${wait}s before requesting another OTP`);
  }

  await OtpToken.deleteMany({ destination: dest, channel });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await OtpToken.create({
    destination: dest,
    channel,
    codeHash: hashCode(code),
    expiresAt,
  });

  const mock = useMock(channel);

  if (mock) {
    console.log(`[OTP mock] ${channel} → ${dest}: ${code}`);
    return {
      success: true,
      channel,
      destination: dest,
      mock: true,
      ...(process.env.NODE_ENV !== 'production' ? { debugOtp: code } : {}),
    };
  }

  if (channel === 'email') {
    await sendEmail(dest, code);
  } else {
    await sendSms(dest, code);
  }

  return { success: true, channel, destination: dest, mock: false };
};

/**
 * Verify OTP for a destination.
 */
export const verifyOTP = async ({ channel = 'sms', phoneNumber, email, otp } = {}) => {
  const dest = normalizeDestination(channel, phoneNumber, email);
  const code = String(otp || '').trim();

  if (!/^\d{6}$/.test(code)) {
    return { success: false, message: 'OTP must be a 6-digit code' };
  }

  const record = await OtpToken.findOne({ destination: dest, channel }).sort({ createdAt: -1 });
  if (!record) {
    return { success: false, message: 'OTP expired or not found. Request a new one.' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await OtpToken.deleteMany({ destination: dest, channel });
    return { success: false, message: 'OTP expired. Request a new one.' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await OtpToken.deleteMany({ destination: dest, channel });
    return { success: false, message: 'Too many attempts. Request a new OTP.' };
  }

  if (record.codeHash !== hashCode(code)) {
    record.attempts += 1;
    await record.save();
    return { success: false, message: 'Invalid OTP' };
  }

  await OtpToken.deleteMany({ destination: dest, channel });
  return { success: true, destination: dest, channel };
};
