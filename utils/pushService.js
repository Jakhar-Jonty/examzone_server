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

// ─── Batch sending (scheduled reminders) ─────────────────────────────

const EXPO_CHUNK = 100; // Expo push API limit per request
const FCM_CHUNK = 500; // FCM sendEach limit
const DEAD_FCM_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Remove tokens of uninstalled apps / expired browsers from every user. */
export const pruneDeadTokens = async (tokens) => {
  if (!tokens.length) return;
  await User.updateMany(
    { 'pushTokens.token': { $in: tokens } },
    { $pull: { pushTokens: { token: { $in: tokens } } } }
  );
};

/**
 * Send one notification per item in bulk: one insertMany for the in-app
 * copies, chunked Expo/FCM pushes, and pruning of dead device tokens.
 * items: [{ user: { _id, pushTokens }, payload: { title, message, type,
 *          category, priority, groupKey, actionUrl, relatedExam, data } }]
 */
export const sendBatchNotifications = async (items) => {
  if (!items.length) return { created: 0, pushed: 0, pruned: 0 };

  const now = new Date();
  const created = await Notification.insertMany(
    items.map(({ user, payload }) => {
      const { data, ...fields } = payload;
      return {
        user: user._id,
        ...fields,
        sentAt: now,
        deliveryChannel: { inApp: true, push: (user.pushTokens || []).length > 0 },
      };
    }),
    { ordered: true }
  );

  const expoMessages = [];
  const fcmMessages = [];
  items.forEach(({ user, payload }, i) => {
    const data = {
      notificationId: String(created[i]._id),
      type: payload.type,
      actionUrl: payload.actionUrl || '',
      ...(payload.data || {}),
    };
    for (const { token } of user.pushTokens || []) {
      if (!token) continue;
      if (isExpoToken(token)) {
        expoMessages.push({
          to: token,
          sound: 'default',
          title: payload.title,
          body: payload.message,
          data,
          priority: 'high',
          channelId: 'default',
        });
      } else {
        fcmMessages.push({
          token,
          notification: { title: payload.title, body: payload.message },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          webpush: { notification: { icon: '/icon-192.png', badge: '/badge-72.png' } },
        });
      }
    }
  });

  const dead = [];
  for (const batch of chunk(expoMessages, EXPO_CHUNK)) {
    const res = await sendExpoPush(batch);
    (res?.data || []).forEach((ticket, j) => {
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(batch[j].to);
      }
    });
  }

  const messaging = fcmMessages.length ? await getMessaging() : null;
  if (messaging) {
    for (const batch of chunk(fcmMessages, FCM_CHUNK)) {
      try {
        const res = await messaging.sendEach(batch);
        res.responses.forEach((r, j) => {
          if (!r.success && DEAD_FCM_CODES.has(r.error?.code)) dead.push(batch[j].token);
        });
      } catch (err) {
        console.error('FCM batch failed:', err.message);
      }
    }
  }

  await pruneDeadTokens(dead);
  return { created: created.length, pushed: expoMessages.length + fcmMessages.length, pruned: dead.length };
};
