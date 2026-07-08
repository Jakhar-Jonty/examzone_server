import User from '../models/User.js';
import Notification from '../models/Notification.js';

// POST /api/notifications/register-token
// Body: { token, platform }
export const registerToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Dedupe — replace existing entry for this token.
    user.pushTokens = (user.pushTokens || []).filter((t) => t.token !== token);
    user.pushTokens.push({ token, platform, addedAt: new Date() });
    await user.save();

    res.json({ message: 'Token registered' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/notifications/unregister-token  (call on logout)
export const unregisterToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushTokens: { token } },
    });

    res.json({ message: 'Token removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notifications?page=1&limit=20
export const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
      page,
      hasMore: page * limit < total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });
    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Not found' });
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'All marked read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
