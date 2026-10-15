// Keeps the "All-Haryana Live Mocks" test series in step with the weekly live
// mocks, newest first, so past papers stay easy to find and practise.
import Exam from '../models/Exam.js';
import TestSeries from '../models/TestSeries.js';
import User from '../models/User.js';
import { getFocus } from './focus.js';

export const LIVE_SERIES_TITLE = 'All-Haryana Live Mocks';

export const syncLiveMockSeries = async () => {
  const focus = await getFocus();
  const mocks = await Exam.find({
    isLiveMock: true,
    $or: [{ deleted: false }, { deleted: { $exists: false } }],
  })
    .sort({ scheduledTime: -1 })
    .select('_id duration')
    .lean();
  if (!mocks.length) return null;

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  return TestSeries.findOneAndUpdate(
    { title: LIVE_SERIES_TITLE },
    {
      $set: {
        description:
          'Every Sunday 11 AM — same paper for all of Haryana. Past papers stay open for practice. हर रविवार सुबह 11 बजे — पूरे हरियाणा के लिए एक पेपर।',
        category: focus?.id,
        seriesType: 'full-length',
        enrollmentType: 'free',
        isPremium: false,
        price: 0,
        status: 'published',
        exams: mocks.map((m, i) => ({ exam: m._id, order: i + 1, unlockCondition: { type: 'none' } })),
        totalTests: mocks.length,
        estimatedDuration: Math.max(1, Math.round(mocks.reduce((n, m) => n + (m.duration || 0), 0) / 60)),
        updatedAt: new Date(),
      },
      $setOnInsert: { publishedAt: new Date(), createdAt: new Date(), createdBy: admin?._id },
    },
    { upsert: true, new: true }
  );
};
