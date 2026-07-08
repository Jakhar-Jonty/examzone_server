import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema({
    badgeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },

    // Visual
    icon: { type: String, required: true },
    color: { type: String, default: '#FFD700' },
    image: { type: String },

    // Category
    category: {
        type: String,
        enum: [
            'streak',
            'test-completion',
            'score',
            'accuracy',
            'speed',
            'mastery',
            'special',
            'seasonal'
        ],
        required: true
    },

    // Criteria (condition to earn)
    criteria: {
        type: {
            type: String,
            enum: [
                'streak-days',
                'tests-completed',
                'score-threshold',
                'accuracy-threshold',
                'perfect-score',
                'speed-master',
                'subject-mastery',
                'rank-achievement',
                'custom'
            ],
            required: true
        },
        value: {}, // Threshold value (Mixed)
        description: { type: String }
    },

    // Rarity
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },

    // Rewards (XP, etc.)
    rewards: {
        xp: { type: Number, default: 0 },
        coins: { type: Number, default: 0 } // If you add a coin system
    },

    // Statistics
    totalAwarded: { type: Number, default: 0 },

    // Status
    isActive: { type: Boolean, default: true },
    isHidden: { type: Boolean, default: false }, // Secret badges

    createdAt: { type: Date, default: Date.now }
});

badgeSchema.index({ badgeId: 1 });
badgeSchema.index({ category: 1, isActive: 1 });

export default mongoose.model("Badge", badgeSchema);