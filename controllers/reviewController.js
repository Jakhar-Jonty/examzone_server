import mongoose from 'mongoose';
import Review from '../models/Review.js';
import TestSeries from '../models/TestSeries.js';
import Exam from '../models/Exam.js';

/**
 * Reviews & ratings for exams / test-series.
 *
 * One review per user per target (enforced by upsert). After any change we
 * recompute the target's average rating so cards/detail stay in sync.
 */

const TARGET_FIELD = { exam: 'exam', 'test-series': 'testSeries' };

// Build the {user, targetType, <targetField>} filter for a target.
const targetFilter = (userId, targetType, targetId) => {
  const field = TARGET_FIELD[targetType];
  return { user: userId, targetType, [field]: targetId };
};

// Recompute and persist average rating + count on the target document.
const recomputeAverage = async (targetType, targetId) => {
  const field = TARGET_FIELD[targetType];
  if (!field) return;

  const agg = await Review.aggregate([
    { $match: { targetType, [field]: new mongoose.Types.ObjectId(targetId), isHidden: { $ne: true } } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0;
  const count = agg[0] ? agg[0].count : 0;

  if (targetType === 'test-series') {
    await TestSeries.findByIdAndUpdate(targetId, { averageRating: avg, reviewCount: count });
  } else if (targetType === 'exam') {
    await Exam.findByIdAndUpdate(targetId, { averageRating: avg, reviewCount: count }).catch(() => {});
  }
};

// POST /api/reviews
// Body: { targetType, targetId, rating, title?, comment?, aspects? }
export const upsertReview = async (req, res) => {
  try {
    const { targetType, targetId, rating, title, comment, aspects } = req.body;

    if (!TARGET_FIELD[targetType]) {
      return res.status(400).json({ message: 'Invalid targetType' });
    }
    if (!targetId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'targetId and rating (1-5) are required' });
    }

    const field = TARGET_FIELD[targetType];
    const review = await Review.findOneAndUpdate(
      targetFilter(req.user._id, targetType, targetId),
      {
        user: req.user._id,
        targetType,
        [field]: targetId,
        rating,
        title,
        comment,
        ...(aspects ? { aspects } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await recomputeAverage(targetType, targetId);
    res.status(201).json({ message: 'Review saved', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/reviews?targetType=&targetId=&page=&limit=
// Returns reviews + summary { average, count, distribution: {1..5} }.
export const getReviews = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);

    if (!TARGET_FIELD[targetType] || !targetId) {
      return res.status(400).json({ message: 'targetType and targetId are required' });
    }
    const field = TARGET_FIELD[targetType];
    const match = { targetType, [field]: targetId, isHidden: { $ne: true } };

    const [reviews, total, distAgg] = await Promise.all([
      Review.find(match)
        .populate('user', 'name profileImage')
        .sort({ isFeatured: -1, helpfulVotes: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(match),
      Review.aggregate([
        { $match: { targetType, [field]: new mongoose.Types.ObjectId(targetId), isHidden: { $ne: true } } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const d of distAgg) {
      distribution[d._id] = d.count;
      sum += d._id * d.count;
    }
    const average = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;

    res.json({
      reviews,
      summary: { average, count: total, distribution },
      page,
      hasMore: page * limit < total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/reviews/me?targetType=&targetId=
export const getMyReview = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    if (!TARGET_FIELD[targetType] || !targetId) {
      return res.status(400).json({ message: 'targetType and targetId are required' });
    }
    const review = await Review.findOne(
      targetFilter(req.user._id, targetType, targetId)
    ).lean();
    res.json({ review: review || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/reviews/:id  (own review)
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const targetId = review.testSeries || review.exam;
    const targetType = review.targetType;
    await review.deleteOne();
    await recomputeAverage(targetType, targetId);

    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
