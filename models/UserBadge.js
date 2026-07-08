import mongoose from "mongoose";

const userBadgeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    badge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
        required: true
    },

    // When & How Earned
    earnedAt: { type: Date, default: Date.now },
    earnedFrom: {
        type: { type: String, enum: ['exam', 'streak', 'achievement', 'manual'] },
        referenceId: { type: mongoose.Schema.Types.ObjectId }
    },

    // Progress (if badge has levels)
    currentLevel: { type: Number, default: 1 },
    progress: { type: Number, default: 0 }, // Percentage to next level

    // Display
    isDisplayed: { type: Boolean, default: false }, // Show on profile
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: false
});

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
userBadgeSchema.index({ user: 1, earnedAt: -1 });


export default mongoose.model("UserBadge", userBadgeSchema);