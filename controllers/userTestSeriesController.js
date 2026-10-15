import mongoose from 'mongoose';
import TestSeries from '../models/TestSeries.js';
import { getFocus, focusFilter } from '../utils/focus.js';
import TestSeriesEnrollment from '../models/TestSeriesEnrollment.js';
import ExamAttempt from '../models/ExamAttempt.js';
import User from '../models/User.js';

/**
 * User-facing Test Series API.
 *
 * Access: free series are open to everyone (enrolment is created silently on
 * the first test), premium series are open to Premium subscribers, and series
 * with a price need an enrolment that hasn't expired.
 * Progress is computed on demand from completed ExamAttempts.
 */

const isPaidSeries = (s) => (s.price || 0) > 0 || s.enrollmentType === 'paid';
export const seriesAccessType = (s) => (isPaidSeries(s) ? 'paid' : s.isPremium ? 'premium' : 'free');

const hasActivePremium = (user) =>
  user?.subscriptionStatus === 'premium' && (!user.subscriptionExpiry || new Date(user.subscriptionExpiry) > new Date());

const enrollmentActive = (e) =>
  !!e && !['cancelled', 'expired'].includes(e.status) && (!e.expiresAt || new Date(e.expiresAt) > new Date());

/** Can this user take the series' tests (before any per-test unlock rules)? */
const canAccessSeries = (series, user, enrollment) => {
  const type = seriesAccessType(series);
  if (type === 'free') return true;
  if (type === 'premium' && hasActivePremium(user)) return true;
  return enrollmentActive(enrollment);
};

// Best completed attempt per exam for this user.
const bestAttempts = async (userId, examIds) => {
  if (!examIds.length) return new Map();
  const attempts = await ExamAttempt.find({ user: userId, exam: { $in: examIds }, isCompleted: true })
    .select('exam percentage totalScore')
    .lean();
  const best = new Map();
  for (const a of attempts) {
    const key = String(a.exam);
    const prev = best.get(key);
    if (!prev || (a.percentage || 0) > (prev.percentage || 0)) {
      best.set(key, { percentage: a.percentage || 0, score: a.totalScore || 0, attemptId: a._id });
    }
  }
  return best;
};

const examIdOf = (e) => String(e.exam?._id || e.exam);

const progressFrom = (examIds, best) => {
  const done = examIds.filter((id) => best.has(id));
  const avg = done.length ? done.reduce((s, id) => s + best.get(id).percentage, 0) / done.length : 0;
  return {
    totalTests: examIds.length,
    testsCompleted: done.length,
    progressPercentage: examIds.length ? Math.round((done.length / examIds.length) * 100) : 0,
    averageScore: Math.round(avg * 10) / 10,
    completedExamIds: done,
  };
};

// GET /api/test-series?subExam=&search= — published series of the focus exam, with my progress
export const getPublishedSeries = async (req, res) => {
  try {
    const { category, search, subExam, page = 1, limit = 30 } = req.query;
    const and = [];
    if (category) and.push({ category });
    const focus = await getFocus();
    if (focus) and.push(focusFilter(focus));
    // a sub-exam shows its own series plus the family-wide ones
    if (subExam && mongoose.isValidObjectId(subExam)) {
      and.push({ $or: [{ subCategory: new mongoose.Types.ObjectId(subExam) }, { subCategory: null }] });
    }
    const query = { status: 'published', ...(and.length ? { $and: and } : {}) };
    if (search) query.title = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [series, total, user] = await Promise.all([
      TestSeries.find(query)
        .populate('category', 'name code')
        .populate('subCategory', 'name')
        .select('title description thumbnail seriesType isPremium price discountPrice enrollmentType totalTests estimatedDuration averageRating enrollments category subCategory exams.exam publishedAt')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      TestSeries.countDocuments(query),
      User.findById(req.user._id).select('subscriptionStatus subscriptionExpiry').lean(),
    ]);

    const enrollments = await TestSeriesEnrollment.find({ user: req.user._id, testSeries: { $in: series.map((s) => s._id) } })
      .select('testSeries status expiresAt')
      .lean();
    const enrollmentBy = new Map(enrollments.map((e) => [String(e.testSeries), e]));
    const allExamIds = [...new Set(series.flatMap((s) => (s.exams || []).map(examIdOf)))];
    const best = await bestAttempts(req.user._id, allExamIds);

    res.json({
      series: series.map(({ exams, ...s }) => {
        const enrollment = enrollmentBy.get(String(s._id));
        const progress = progressFrom((exams || []).map(examIdOf), best);
        delete progress.completedExamIds;
        return {
          ...s,
          totalTests: (exams || []).length || s.totalTests || 0,
          access: seriesAccessType(s),
          canAccess: canAccessSeries(s, user, enrollment),
          isEnrolled: !!enrollment,
          progress,
        };
      }),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/test-series/:id — detail with exams, access, per-test best score and the next test
export const getSeriesDetail = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Test series not found' });
    const series = await TestSeries.findOne({ _id: req.params.id, status: 'published' })
      .populate('category', 'name code')
      .populate('subCategory', 'name')
      .populate('exams.exam', 'title duration totalMarks totalQuestions status scheduledTime isLiveMock')
      .lean();
    if (!series) return res.status(404).json({ message: 'Test series not found' });

    const [enrollment, user] = await Promise.all([
      TestSeriesEnrollment.findOne({ user: req.user._id, testSeries: series._id }).lean(),
      User.findById(req.user._id).select('subscriptionStatus subscriptionExpiry').lean(),
    ]);

    const ordered = [...(series.exams || [])].filter((e) => e.exam).sort((a, b) => (a.order || 0) - (b.order || 0));
    const best = await bestAttempts(req.user._id, ordered.map(examIdOf));
    const progress = progressFrom(ordered.map(examIdOf), best);
    const access = seriesAccessType(series);
    const canAccess = canAccessSeries(series, user, enrollment);
    const now = new Date();

    let nextIndex = -1;
    const exams = ordered.map((e, idx) => {
      const id = examIdOf(e);
      const result = best.get(id) || null;
      let locked = false;
      let lockReason = null;
      if (!canAccess) {
        locked = true;
        lockReason = access === 'premium' ? 'premium' : 'purchase';
      } else if (e.unlockCondition?.type === 'previous-completion' && idx > 0 && !best.has(examIdOf(ordered[idx - 1]))) {
        locked = true;
        lockReason = 'previous';
      } else if (e.exam.scheduledTime && new Date(e.exam.scheduledTime) > now) {
        locked = true;
        lockReason = 'scheduled';
      }
      if (nextIndex === -1 && !locked && !result) nextIndex = idx;
      return {
        ...e,
        completed: !!result,
        result, // { percentage, score, attemptId } of the best attempt
        locked,
        lockReason,
        opensAt: lockReason === 'scheduled' ? e.exam.scheduledTime : null,
      };
    });

    res.json({
      series: { ...series, exams, totalTests: exams.length },
      access,
      canAccess,
      enrollment: enrollment || null,
      isEnrolled: !!enrollment,
      enrollmentExpired: !!enrollment && !enrollmentActive(enrollment),
      nextIndex,
      progress,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/test-series/:id/enroll
// Free series and premium series (for Premium members) enrol immediately; priced
// series accept a mock payment for now — swap in real verification when ready.
export const enrollSeries = async (req, res) => {
  try {
    const series = await TestSeries.findOne({ _id: req.params.id, status: 'published' });
    if (!series) return res.status(404).json({ message: 'Test series not found' });

    const existing = await TestSeriesEnrollment.findOne({ user: req.user._id, testSeries: series._id });
    if (existing && enrollmentActive(existing)) return res.json({ message: 'Already enrolled', enrollment: existing });

    if (series.maxEnrollments && series.currentEnrollments >= series.maxEnrollments) {
      return res.status(400).json({ message: 'Enrollment limit reached' });
    }

    const access = seriesAccessType(series);
    const user = await User.findById(req.user._id).select('subscriptionStatus subscriptionExpiry').lean();
    if (access === 'premium' && !hasActivePremium(user)) {
      return res.status(402).json({ message: 'This series is part of Premium.', needsPremium: true });
    }
    const { paymentId, isMock } = req.body || {};
    if (access === 'paid' && !paymentId && !isMock) {
      return res.status(402).json({ message: 'Payment required', price: series.discountPrice || series.price });
    }

    const expiresAt = series.validityDays
      ? new Date(Date.now() + series.validityDays * 24 * 60 * 60 * 1000)
      : series.endDate || null;
    const fields = {
      totalTests: (series.exams || []).length || series.totalTests || 0,
      isPaid: access === 'paid',
      amountPaid: access === 'paid' ? series.discountPrice || series.price : 0,
      paymentId: paymentId || (access === 'paid' ? `pay_mock_${Date.now()}` : undefined),
      transactionDate: access === 'paid' ? new Date() : undefined,
      expiresAt,
      status: 'active',
    };

    let enrollment;
    if (existing) {
      // renewing an expired enrolment
      Object.assign(existing, fields);
      enrollment = await existing.save();
    } else {
      enrollment = await TestSeriesEnrollment.create({ user: req.user._id, testSeries: series._id, ...fields });
      series.currentEnrollments = (series.currentEnrollments || 0) + 1;
      series.enrollments = (series.enrollments || 0) + 1;
      await series.save();
    }
    res.status(201).json({ message: 'Enrolled successfully', enrollment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/test-series/:id/enroll — remove a saved series from My Series.
// Purchased series stay (removing would look like cancelling a payment).
export const unenrollSeries = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Test series not found' });
    const enrollment = await TestSeriesEnrollment.findOne({ user: req.user._id, testSeries: req.params.id });
    if (!enrollment) return res.json({ message: 'Not in My Series' });
    if (enrollment.isPaid) {
      return res.status(400).json({ message: 'Purchased series stay in My Series.' });
    }
    await enrollment.deleteOne();
    await TestSeries.updateOne(
      { _id: req.params.id, enrollments: { $gt: 0 } },
      { $inc: { enrollments: -1, currentEnrollments: -1 } }
    );
    res.json({ message: 'Removed from My Series' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/test-series/me/enrollments — my series (focus exam only) with progress and the next test
export const getMyEnrollments = async (req, res) => {
  try {
    const focus = await getFocus();
    const enrollments = await TestSeriesEnrollment.find({ user: req.user._id })
      .populate({
        path: 'testSeries',
        select: 'title thumbnail seriesType totalTests exams isPremium price discountPrice enrollmentType category status',
        populate: { path: 'exams.exam', select: '_id title scheduledTime' },
      })
      .sort({ enrolledAt: -1 })
      .lean();

    const focusIds = focus ? new Set(focus.ids.map(String)) : null;
    const valid = enrollments.filter(
      (e) => e.testSeries && e.testSeries.status === 'published' && (!focusIds || focusIds.has(String(e.testSeries.category)))
    );
    const best = await bestAttempts(req.user._id, [...new Set(valid.flatMap((e) => (e.testSeries.exams || []).map(examIdOf)))]);
    const now = new Date();

    res.json({
      enrollments: valid.map((e) => {
        const ordered = [...(e.testSeries.exams || [])].filter((x) => x.exam).sort((a, b) => (a.order || 0) - (b.order || 0));
        const progress = progressFrom(ordered.map(examIdOf), best);
        delete progress.completedExamIds;
        const nextIdx = ordered.findIndex(
          (x) => !best.has(examIdOf(x)) && !(x.exam.scheduledTime && new Date(x.exam.scheduledTime) > now)
        );
        return {
          _id: e._id,
          enrolledAt: e.enrolledAt,
          status: e.status,
          expiresAt: e.expiresAt || null,
          expired: !enrollmentActive(e),
          testSeries: {
            _id: e.testSeries._id,
            title: e.testSeries.title,
            seriesType: e.testSeries.seriesType,
            access: seriesAccessType(e.testSeries),
          },
          progress,
          next: nextIdx >= 0 ? { index: nextIdx, examId: examIdOf(ordered[nextIdx]), title: ordered[nextIdx].exam.title } : null,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
