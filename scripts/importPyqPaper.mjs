// Import a parsed previous-year paper (content/pyq/*.json) as PYQ questions plus
// one full timed paper in the "HSSC CET Previous Year Papers" series.
//   node scripts/importPyqPaper.mjs content/pyq/cet-2025-26-july-2025-shift-1.json [--apply]
// Re-running is safe: a paper that already exists (same title) is skipped.
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import TestSeries from '../models/TestSeries.js';
import User from '../models/User.js';
import { getFocus } from '../utils/focus.js';

dotenv.config();
const [, , file, flag] = process.argv;
const APPLY = flag === '--apply';
const SOURCE_EXAM = 'HSSC CET Group C';
const YEAR = 2025;
const SERIES_TITLE = 'HSSC CET Previous Year Papers';
const L = ['A', 'B', 'C', 'D'];
const isHindi = (s) => /[ऀ-ॿ]/.test(s);

// The paper follows the CET order; use question numbers to tag the section.
const sectionOf = (num, text) => {
  if (num >= 86) return 'Hindi';
  if (num >= 76 && !isHindi(text)) return 'English';
  return 'HSSC CET PYQ';
};

const run = async () => {
  const paper = JSON.parse(fs.readFileSync(file, 'utf8'));
  const shift = paper.label.replace(/ 2025/, ''); // e.g. "26 July Shift 1"
  const title = `HSSC CET Group C 2025 — ${shift} (Previous Year Paper)`;
  await connectDB();
  console.log(APPLY ? '== APPLYING ==' : '== PREVIEW (pass --apply) ==', title, `${paper.questions.length} questions`);
  if (await Exam.findOne({ title, deleted: { $ne: true } })) {
    console.log('  already imported — skipped');
    return mongoose.disconnect();
  }
  const focus = await getFocus();
  const cetC = (focus?.subCategories || []).find((s) => /cet group c/i.test(s.name));
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();

  const docs = paper.questions.map((q) => {
    const hindi = isHindi(q.q) || q.options.some(isHindi);
    return {
      questionText: q.q,
      questionTextHindi: hindi ? q.q : '',
      questionType: 'MCQ',
      options: q.options.map((t, i) => ({ optionText: t, optionLabel: L[i], isCorrect: i === q.correct })),
      optionsHindi: hindi ? q.options.map((t, i) => ({ optionText: t, optionLabel: L[i] })) : [],
      correctAnswer: L[q.correct],
      explanation: `Official answer: (${L[q.correct]}) ${q.options[q.correct]}`,
      explanationHindi: hindi ? `आधिकारिक उत्तर: (${L[q.correct]}) ${q.options[q.correct]}` : '',
      category: focus?.id,
      subject: sectionOf(q.num, q.q),
      topic: `CET 2025 · ${shift}`,
      difficulty: 'Medium',
      language: hindi ? 'Hindi' : 'English',
      isPYQ: true,
      sourceExam: SOURCE_EXAM,
      sourceYear: YEAR,
      shift,
      status: 'Published',
      publishedAt: new Date(),
      marks: 1,
      negativeMarking: 0,
      flags: [],
      tags: ['pyq', 'cet-2025', `q${q.num}`],
      createdBy: admin?._id,
    };
  });
  const bySection = docs.reduce((m, d) => ({ ...m, [d.subject]: (m[d.subject] || 0) + 1 }), {});
  console.log('  sections', JSON.stringify(bySection));
  if (!APPLY) return mongoose.disconnect();

  const inserted = await Question.insertMany(docs);
  const exam = await Exam.create({
    title,
    description: `Actual HSSC CET Group C paper held on ${paper.label} with the official answer key. ${docs.length} questions (questions that need a figure are left out).`,
    instructions:
      'Previous year paper. 1 mark per question, no negative marking for wrong answers. In the real exam an unattempted question (without option E) cost 1 mark.',
    category: focus?.id,
    ...(cetC ? { subCategory: cetC._id } : {}),
    examType: 'pyq',
    examPattern: 'Single',
    deliveryMode: 'both', // online, or solve on paper and fill the OMR in the app
    scheduledTime: new Date(),
    duration: Math.round((105 * docs.length) / 100),
    questions: inserted.map((q) => q._id),
    totalQuestions: inserted.length,
    totalMarks: inserted.length,
    language: 'Both',
    allowReattempts: true,
    maxAttempts: 5,
    showResultsImmediately: true,
    showCorrectAnswers: true,
    allowQuestionReview: true,
    accessType: 'public',
    isPremium: false,
    status: 'active',
    tags: ['pyq-paper', 'cet-2025'],
    createdBy: admin?._id,
  });

  let series = await TestSeries.findOne({ title: SERIES_TITLE });
  if (!series) {
    series = await TestSeries.create({
      title: SERIES_TITLE,
      description: 'Real HSSC CET Group C papers with official answer keys — attempt them as timed papers.',
      category: focus?.id,
      enrollmentType: 'free',
      isPremium: false,
      price: 0,
      status: 'published',
      publishedAt: new Date(),
      exams: [],
      createdBy: admin?._id,
    });
  }
  series.exams.push({ exam: exam._id, order: series.exams.length + 1, unlockCondition: { type: 'none' } });
  series.totalTests = series.exams.length;
  await series.save();
  console.log(`  inserted ${inserted.length} questions, paper ${exam._id}, series now ${series.exams.length} papers`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('importPyqPaper failed:', err.message);
  process.exit(1);
});
