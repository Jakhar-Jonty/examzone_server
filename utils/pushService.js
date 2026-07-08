import User from '../models/User.js';
import Notification from '../models/Notification.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Firebase Admin — initialized lazily when credentials are present.
let _messaging = null;

const getMessaging = async () => {
  if (_messaging) return _messaging;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) return null;

  try {
    const { default: admin } = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    _messaging = admin.messaging();
    console.log('Firebase Admin messaging initialized');
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message);
  }
  return _messaging;
};

const isExpoToken = (token) =>
  typeof token === 'string' && token.startsWith('ExponentPushToken');

export const sendExpoPush = async (messages) => {
  if (!messages?.length) return null;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    return await res.json();
  } catch (err) {
    console.error('Expo push failed:', err.message);
    return null;
  }
};

const sendFcmPush = async (tokens, { title, body, data = {} }) => {
  const messaging = await getMessaging();
  if (!messaging || !tokens.length) return null;
  try {
    return await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: { notification: { icon: '/icon-192.png', badge: '/badge-72.png' } },
    });
  } catch (err) {
    console.error('FCM push failed:', err.message);
    return null;
  }
};

/**
 * notifyUser — store in-app notification and deliver push (Expo or FCM).
 * Single entry point for all notification sends.
 */
export const notifyUser = async (userId, payload) => {
  try {
    const {
      title,
      message,
      type = 'system',
      category = 'update',
      priority = 'medium',
      data = {},
      ...rest
    } = payload;

    const user = await User.findById(userId).select('pushTokens preferences');
    if (!user) return null;

    const pushEnabled =
      user.preferences?.notificationsEnabled !== false &&
      user.preferences?.pushNotifications !== false;
    const tokens = (user.pushTokens || []).map((t) => t.token).filter(Boolean);

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      category,
      priority,
      sentAt: new Date(),
      deliveryChannel: { inApp: true, push: pushEnabled && tokens.length > 0 },
      ...rest,
    });

    if (pushEnabled && tokens.length > 0) {
      const expoTokens = tokens.filter(isExpoToken);
      const fcmTokens = tokens.filter((t) => !isExpoToken(t));

      if (expoTokens.length) {
        await sendExpoPush(
          expoTokens.map((to) => ({
            to,
            sound: 'default',
            title,
            body: message,
            data: { notificationId: String(notification._id), type, ...data },
            priority: priority === 'urgent' || priority === 'high' ? 'high' : 'default',
          }))
        );
      }

      if (fcmTokens.length) {
        await sendFcmPush(fcmTokens, {
          title,
          body: message,
          data: { notificationId: String(notification._id), type, ...data },
        });
      }
    }

    return notification;
  } catch (err) {
    console.error('notifyUser failed:', err.message);
    return null;
  }
};

export const notifyMany = async (userIds, payload) => {
  for (const id of userIds) {
    await notifyUser(id, payload);
  }
};
