import mongoose from "mongoose";

const testSeriesSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    thumbnail: { type: String },

    // Categorization
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    tier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tier'
    },

    // Series Details
    seriesType: {
        type: String,
        enum: ['mock', 'practice', 'sectional', 'pyq', 'topic-wise', 'full-length'],
        default: 'mock'
    },

    // Exams in Series
    exams: [{
        exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
        order: { type: Number, required: true },
        isLocked: { type: Boolean, default: false },
        unlockCondition: {
            type: { type: String, enum: ['none', 'previous-completion', 'minimum-score', 'date'] },
            value: {} // Score threshold or date (Mixed)
        },
        scheduledDate: { type: Date } // When this exam becomes available
    }],

    // Pricing
    isPremium: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    discountPrice: { type: Number },

    // Validity
    validityDays: { type: Number }, // How many days access after purchase/enrollment
    startDate: { type: Date },
    endDate: { type: Date },

    // Enrollment
    enrollmentType: {
        type: String,
        enum: ['free', 'paid', 'invite-only'],
        default: 'free'
    },
    maxEnrollments: { type: Number }, // Limit enrollments
    currentEnrollments: { type: Number, default: 0 },

    // Statistics
    totalTests: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    estimatedDuration: { type: Number }, // Total hours

    // Status
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    publishedAt: { type: Date },

    // Tags & SEO
    tags: [{ type: String }],
    keywords: [{ type: String }],

    // Features
    features: [{
        type: String,
        // e.g., 'Video Solutions', 'Live Leaderboard', 'PDF Report'
    }],

    // Analytics
    views: { type: Number, default: 0 },
    enrollments: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

testSeriesSchema.index({ category: 1, status: 1 });
testSeriesSchema.index({ isPremium: 1 });
testSeriesSchema.index({ publishedAt: -1 });


export default mongoose.model("TestSeries", testSeriesSchema);