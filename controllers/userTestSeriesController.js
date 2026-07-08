import TestSeries from '../models/TestSeries.js';
import TestSeriesEnrollment from '../models/TestSeriesEnrollment.js';
import ExamAttempt from '../models/ExamAttempt.js';

/**
 * User-facing Test Series API.
 *
 * Progress is computed on demand from completed ExamAttempts that match the
 * series' exams — so nothing in the exam submit path needs to change.
 */

// Compute completion/score progress for a user across a series' exams.
const computeProgress = async (userId, examEntries) => {
  const examIds = (examEntries || []).map((e) => e.exam?._id || e.exam).filter(Boolean);
  const totalTests = examIds.length;
  if (totalTests === 0) {
    return { totalTests: 0, testsCompleted: 0, progressPercentage: 0, averageScore: 0, completedExamIds: [] };
  }

  const attempts = await ExamAttempt.find({
    user: userId,
    exam: { $in: examIds },
    isCompleted: true,
  })
    .select('exam percentage')
    .lean();

  // Best attempt per exam.
  const bestByExam = new Map();
  for (const a of attempts) {
    const key = String(a.exam);
    if (!bestByExam.has(key) || a.percentage > bestByExam.get(key)) {
      bestByExam.set(key, a.percentage || 0);
    }
  }

  const completedExamIds = [...bestByExam.keys()];
  const testsCompleted = completedExamIds.length;
  const avg =
    testsCompleted > 0
      ? [...bestByExam.values()].reduce((s, v) => s + v, 0) / testsCompleted
      : 0;

  return {
    totalTests,
    testsCompleted,
    progressPercentage: Math.round((testsCompleted / totalTests) * 100),
    averageScore: Math.round(avg * 10) / 10,
    completedExamIds,
  };
};

// GET /api/test-series  — published series (browse), with my-enrollment flag.
export const getPublishedSeries = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const query = { status: 'published' };
    if (category) query.category = category;
    if (search) query.title = new RegExp(search, 'i');

    const [series, total] = await Promise.all([
      TestSeries.find(query)
        .populate('category', 'name code')
        .populate('tier', 'name code')
        .select('title description thumbnail seriesType isPremium price discountPrice accessType totalTests estimatedDuration averageRating enrollments category tier')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      TestSeries.countDocuments(query),
    ]);

    const enrolled = await TestSeriesEnrollment.find({
      user: req.user._id,
      testSeries: { $in: series.map((s) => s._id) },
    }).select('testSeries').lean();
    const enrolledSet = new Set(enrolled.map((e) => String(e.testSeries)));

    res.json({
      series: series.map((s) => ({ ...s, isEnrolled: enrolledSet.has(String(s._id)) })),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/test-series/:id — detail with exams, my enrollment, per-exam status.
export const getSeriesDetail = async (req, res) => {
  try {
    const series = await TestSeries.findOne({ _id: req.params.id, status: 'published' })
      .populate('category', 'name code')
      .populate('tier', 'name code')
      .populate('exams.exam', 'title duration totalMarks status')
      .lean();

    if (!series) return res.status(404).json({ message: 'Test series not found' });

    const enrollment = await TestSeriesEnrollment.findOne({
      user: req.user._id,
      testSeries: series._id,
    }).lean();

    const progress = await computeProgress(req.user._id, series.exams);
    const completedSet = new Set(progress.completedExamIds);

    // Order exams + attach lock/completion. A test is takeable if the user is
    // enrolled (or the series is free) and any previous-completion gate is met.
    const isEnrolled = !!enrollment;
    const canAccess = isEnrolled || series.accessType === 'free';
    const orderedExams = [...(series.exams || [])]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((e, idx, arr) => {
        const examId = e.exam?._id ? String(e.exam._id) : String(e.exam);
        const completed = completedSet.has(examId);
        let locked = !canAccess;
        if (canAccess && e.unlockCondition?.type === 'previous-completion' && idx > 0) {
          const prev = arr[idx - 1];
          const prevId = prev.exam?._id ? String(prev.exam._id) : String(prev.exam);
          locked = !completedSet.has(prevId);
        }
        return { ...e, completed, locked };
      });

    res.json({
      series: { ...series, exams: orderedExams },
      enrollment: enrollment || null,
      isEnrolled,
      progress,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/test-series/:id/enroll
// Free series enroll immediately. Paid series accept a mock payment for now
// (matches subscription mock mode); swap in real verification when ready.
export const enrollSeries = async (req, res) => {
  try {
    const series = await TestSeries.findOne({ _id: req.params.id, status: 'published' });
    if (!series) return res.status(404).json({ message: 'Test series not found' });

    const existing = await TestSeriesEnrollment.findOne({
      user: req.user._id,
      testSeries: series._id,
    });
    if (existing) return res.json({ message: 'Already enrolled', enrollment: existing });

    if (series.maxEnrollments && series.currentEnrollments >= series.maxEnrollments) {
      return res.status(400).json({ message: 'Enrollment limit reached' });
    }

    const isPaidSeries = series.accessType === 'paid' || series.isPremium || series.price > 0;
    const { paymentId, isMock } = req.body || {};
    if (isPaidSeries && !paymentId && !isMock) {
      // Caller should run the payment flow first and pass paymentId/isMock.
      return res.status(402).json({ message: 'Payment required', price: series.discountPrice || series.price });
    }

    const expiresAt = series.validityDays
      ? new Date(Date.now() + series.validityDays * 24 * 60 * 60 * 1000)
      : series.endDate || null;

    const enrollment = await TestSeriesEnrollment.create({
      user: req.user._id,
      testSeries: series._id,
      totalTests: series.totalTests || (series.exams || []).length,
      isPaid: isPaidSeries,
      amountPaid: isPaidSeries ? (series.discountPrice || series.price) : 0,
      paymentId: paymentId || (isPaidSeries ? `pay_mock_${Date.now()}` : undefined),
      transactionDate: isPaidSeries ? new Date() : undefined,
      expiresAt,
      status: 'active',
    });

    series.currentEnrollments = (series.currentEnrollments || 0) + 1;
    series.enrollments = (series.enrollments || 0) + 1;
    await series.save();

    res.status(201).json({ message: 'Enrolled successfully', enrollment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/test-series/me/enrollments — my series with live progress.
export const getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await TestSeriesEnrollment.find({ user: req.user._id })
      .populate({
        path: 'testSeries',
        select: 'title thumbnail seriesType totalTests exams',
        populate: { path: 'exams.exam', select: '_id' },
      })
      .sort({ enrolledAt: -1 })
      .lean();

    const withProgress = await Promise.all(
      enrollments.map(async (e) => {
        const progress = await computeProgress(req.user._id, e.testSeries?.exams || []);
        return {
          ...e,
          testSeries: e.testSeries
            ? { ...e.testSeries, exams: undefined } // trim heavy field
            : null,
          progress,
        };
      })
    );

    res.json({ enrollments: withProgress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
