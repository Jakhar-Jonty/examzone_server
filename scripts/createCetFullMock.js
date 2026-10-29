// Build the next full-length HSSC CET mock (100 questions, 105 minutes) from the
// question bank and add it to the "CET Group C Mock Series":
//   node scripts/createCetFullMock.js            → preview
//   node scripts/createCetFullMock.js --apply    → create
//
// Questions already used in earlier full mocks are skipped, so each mock is new.
// Questions are grouped by subject in the paper, in the order of MIX.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import TestSeries from '../models/TestSeries.js';
import User from '../models/User.js';
import { getFocus } from '../utils/focus.js';
import { visibleStatus } from '../utils/questionVisibility.js';

dotenv.config();
const APPLY = process.argv.includes('--apply');
const SERIES_TITLE = 'CET Group C Mock Series';
const TAG = 'cet-full-mock';
const DURATION = 105; // minutes
// CET-style split of 100 questions; Haryana GK carries the most weight
const MIX = {
  'Haryana GK': 20,
  'General Knowledge': 15,
  Reasoning: 15,
  Maths: 15,
  Hindi: 10,
  English: 10,
  'General Science': 8,
  'Computer Science': 7,
};

const run = async () => {
  await connectDB();
  console.log(APPLY ? '== APPLYING ==' : '== PREVIEW (pass --apply) ==');
  const focus = await getFocus();
  if (!focus) throw new Error('Focus mode is off.');
  const cetC = (focus.subCategories || []).find((s) => /cet group c/i.test(s.name));

  const earlier = await Exam.find({ tags: TAG, deleted: { $ne: true } }).select('questions').lean();
  const used = earlier.flatMap((e) => e.questions || []);
  const number = earlier.length + 1;

  const picked = [];
  for (const [subject, n] of Object.entries(MIX)) {
    const rows = await Question.aggregate([
      {
        $match: {
          subject,
          status: visibleStatus(),
          deleted: { $ne: true },
          questionType: { $in: ['MCQ', null] },
          category: { $in: focus.ids },
          'options.3': { $exists: true },
          questionTextHindi: { $nin: [null, ''] },
          tags: { $ne: 'test-content' },
          // only checked content: human-verified, or written/reviewed for this bank
          $or: [{ humanVerified: true }, { tags: { $in: ['claude-authored', 'claude-reviewed'] } }],
          _id: { $nin: used },
        },
      },
      { $sample: { size: n } },
      { $project: { _id: 1 } },
    ]);
    console.log(`  ${subject.padEnd(18)} ${rows.length}/${n}`);
    if (rows.length < n) throw new Error(`Not enough unused ${subject} questions for mock #${number}.`);
    picked.push(...rows.map((r) => r._id));
  }

  const title = `CET Group C — Full Mock ${number} (100 Qs)`;
  console.log(`  ${title}: ${picked.length} questions, ${DURATION} min`);
  if (!APPLY) return mongoose.disconnect();

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  const exam = await Exam.create({
    title,
    description:
      'Full-length CET-pattern mock: Haryana GK, General Knowledge, Reasoning, Maths, Hindi, English, Science and Computer — 100 questions in 105 minutes.',
    instructions:
      '100 questions, 1 mark each, 105 minutes. No negative marking in this practice paper. Questions are grouped by subject: Haryana GK, General Knowledge, Reasoning, Maths, Hindi, English, Science, Computer.',
    category: focus.id,
    ...(cetC ? { subCategory: cetC._id } : {}),
    examType: 'mock',
    examPattern: 'Single',
    deliveryMode: 'both', // online, or solve on paper and fill the OMR in the app
    scheduledTime: new Date(),
    duration: DURATION,
    questions: picked,
    totalQuestions: picked.length,
    totalMarks: picked.length,
    language: 'Both',
    allowReattempts: true,
    maxAttempts: 3,
    showResultsImmediately: true,
    showCorrectAnswers: true,
    allowQuestionReview: true,
    accessType: 'public',
    isPremium: false,
    status: 'active',
    tags: [TAG],
    createdBy: admin?._id,
  });

  const series = await TestSeries.findOne({ title: SERIES_TITLE });
  if (series) {
    series.exams.push({ exam: exam._id, order: series.exams.length + 1, unlockCondition: { type: 'none' } });
    series.totalTests = series.exams.length;
    await series.save();
    console.log(`  added to "${SERIES_TITLE}" (${series.exams.length} tests)`);
  } else {
    console.log(`  series "${SERIES_TITLE}" not found — exam created standalone`);
  }
  console.log(`  created exam ${exam._id}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('createCetFullMock failed:', err.message);
  process.exit(1);
});
