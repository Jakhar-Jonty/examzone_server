import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';
import User from '../models/User.js';
import crypto from 'crypto';

// =============================================================
// POST /admin/badges
// =============================================================
export const createBadge = async (req, res) => {
    try {
        const {
            name, description, icon, color, image,
            category, criteria, rarity, rewards,
            isHidden
        } = req.body;

        if (!name || !description || !icon || !category || !criteria?.type || criteria?.value == null) {
            return res.status(400).json({ message: 'name, description, icon, category, criteria.type and criteria.value are required.' });
        }

        const badge = new Badge({
            badgeId: crypto.randomBytes(6).toString('hex'),
            name,
            description,
            icon,
            color: color || '#FFD700',
            image,
            category,
            criteria,
            rarity: rarity || 'common',
            rewards: rewards || { xp: 0, coins: 0 },
            isHidden: isHidden || false,
            isActive: true,
        });

        await badge.save();
        res.status(201).json({ message: 'Badge created successfully', badge });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A badge with this ID already exists.' });
        }
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/badges
// =============================================================
export const getBadges = async (req, res) => {
    try {
        const { category, rarity, isActive, search, page = 1, limit = 50 } = req.query;
        const query = {};

        if (category) query.category = category;
        if (rarity) query.rarity = rarity;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        if (search) query.name = new RegExp(search, 'i');

        const [badges, total] = await Promise.all([
            Badge.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean(),
            Badge.countDocuments(query)
        ]);

        res.json({ badges, total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/badges/:id
// =============================================================
export const getBadgeById = async (req, res) => {
    try {
        const badge = await Badge.findById(req.params.id).lean();
        if (!badge) return res.status(404).json({ message: 'Badge not found.' });
        res.json({ badge });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// PUT /admin/badges/:id
// =============================================================
export const updateBadge = async (req, res) => {
    try {
        const badge = await Badge.findById(req.params.id);
        if (!badge) return res.status(404).json({ message: 'Badge not found.' });

        const { badgeId, totalAwarded, ...updateData } = req.body; // Prevent changing badgeId or count
        Object.assign(badge, updateData);
        await badge.save();

        res.json({ message: 'Badge updated successfully', badge });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// DELETE /admin/badges/:id
// =============================================================
export const deleteBadge = async (req, res) => {
    try {
        const badge = await Badge.findByIdAndDelete(req.params.id);
        if (!badge) return res.status(404).json({ message: 'Badge not found.' });
        res.json({ message: 'Badge deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// PATCH /admin/badges/:id/toggle
// =============================================================
export const toggleBadgeActive = async (req, res) => {
    try {
        const badge = await Badge.findById(req.params.id);
        if (!badge) return res.status(404).json({ message: 'Badge not found.' });
        badge.isActive = !badge.isActive;
        await badge.save();
        res.json({ message: `Badge ${badge.isActive ? 'activated' : 'deactivated'}`, badge });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// POST /admin/badges/:id/award
// Award a badge to a specific user manually
// =============================================================
export const awardBadgeToUser = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required.' });

        const [badge, user] = await Promise.all([
            Badge.findById(req.params.id),
            User.findById(userId)
        ]);

        if (!badge) return res.status(404).json({ message: 'Badge not found.' });
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Check if already awarded
        const existing = await UserBadge.findOne({ user: userId, badge: req.params.id });
        if (existing) return res.status(400).json({ message: 'User already has this badge.' });

        const userBadge = new UserBadge({
            user: userId,
            badge: req.params.id,
            earnedFrom: { type: 'manual' },
        });
        await userBadge.save();

        // Increment totalAwarded on the badge
        await Badge.findByIdAndUpdate(req.params.id, { $inc: { totalAwarded: 1 } });

        res.json({ message: `Badge awarded to ${user.name} successfully.`, userBadge });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'User already has this badge.' });
        }
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/users/:userId/badges
// =============================================================
export const getUserBadges = async (req, res) => {
    try {
        const badges = await UserBadge.find({ user: req.params.userId })
            .populate('badge')
            .sort({ earnedAt: -1 })
            .lean();
        res.json({ badges });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// DELETE /admin/users/:userId/badges/:badgeId
// Revoke a manually-awarded badge
// =============================================================
export const revokeUserBadge = async (req, res) => {
    try {
        const { userId, badgeId } = req.params;
        const userBadge = await UserBadge.findOneAndDelete({ user: userId, badge: badgeId });
        if (!userBadge) return res.status(404).json({ message: 'Award record not found.' });

        await Badge.findByIdAndUpdate(badgeId, { $inc: { totalAwarded: -1 } });
        res.json({ message: 'Badge revoked successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
