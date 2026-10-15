// Create / refresh the HSSC test series from existing content (safe to re-run):
//   node scripts/seedHsscSeries.js            → preview
//   node scripts/seedHsscSeries.js --apply    → write
//
// - "Haryana GK Topic Tests": one 15-question test per hub topic (created here)
// - "<Sub-exam> Mock Series": the live mocks of each HSSC sub-exam
// - "All-Haryana Live Mocks": every weekly live mock (new ones are added automatically)
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import TestSeries from '../models/TestSeries.js';
import User from '../models/User.js';
import { getFocus } from '../utils/focus.js';
import { visibleStatus } from '../utils/questionVisibility.js';
import { HARYANA_GK_SUBJECT, HARYANA_GK_TOPICS } from '../utils/haryanaGk.js';
import { syncLiveMockSeries, LIVE_SERIES_TITLE } from '../utils/liveMockSeries.js';

dotenv.config();
const APPLY = process.argv.includes('--apply');
const TOPIC_TEST_SIZE = 15;
const notDeleted = { $or: [{ deleted: false }, { deleted: { $exists: false } }] };

const upsertSeries = async (title, fields, examIds) => {
  const exams = examIds.map((exam, i) => ({ exam, order: i + 1, unlockCondition: { type: 'none' } }));
  console.log(`  ${title}: ${exams.length} tests`);
  if (!APPLY || !exams.length) return;
  await TestSeries.findOneAndUpdate(
    { title },
    {
      $set: { ...fields, exams, totalTests: exams.length, status: 'published', updatedAt: new Date() },
      $setOnInsert: { publishedAt: new Date(), createdAt: new Date() },
    },
    { upsert: true }
  );
};

const run = async () => {
  await connectDB();
  console.log(APPLY ? '== APPLYING ==' : '== PREVIEW (pass --apply) ==');
  const focus = await getFocus();
  if (!focus) throw new Error('Focus mode is off — nothing to seed.');
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  const base = { category: focus.id, enrollmentType: 'free', isPremium: false, price: 0, createdBy: admin?._id };

  // 1. Haryana GK topic tests
  const topicExamIds = [];
  for (const topic of HARYANA_GK_TOPICS.filter((t) => t.key !== 'current-affairs')) {
    const title = `Haryana GK · ${topic.label} — Topic Test`;
    let exam = await Exam.findOne({ title, ...notDeleted });
    if (!exam) {
      const qs = await Question.aggregate([
        { $match: { subject: HARYANA_GK_SUBJECT, topic: topic.label, status: visibleStatus(), category: { $in: focus.ids } } },
        { $sample: { size: TOPIC_TEST_SIZE } },
        { $project: { _id: 1 } },
      ]);
      console.log(`  new topic test: ${title} (${qs.length} Qs)`);
      if (qs.length < 5) continue;
      if (APPLY) {
        exam = await Exam.create({
          title,
          description: `${topic.label} (${topic.labelHindi}) — ${qs.length} Haryana GK questions in English and Hindi.`,
          category: focus.id,
          examType: 'practice',
          scheduledTime: new Date(Date.now() - 60 * 1000),
          duration: qs.length,
          questions: qs.map((q) => q._id),
          totalQuestions: qs.length,
          totalMarks: qs.length,
          language: 'Both',
          status: 'active',
          allowReattempts: true,
          tags: ['topic-test', 'haryana-gk'],
          createdBy: admin?._id,
        });
      }
    }
    if (exam) topicExamIds.push(exam._id);
  }
  await upsertSeries(
    'Haryana GK Topic Tests',
    {
      ...base,
      seriesType: 'topic-wise',
      description: 'One test for each Haryana GK topic — history, districts, culture, polity, schemes and sports. हरियाणा GK के हर टॉपिक का एक टेस्ट।',
      estimatedDuration: Math.round((topicExamIds.length * TOPIC_TEST_SIZE) / 60),
      tags: ['haryana-gk'],
    },
    topicExamIds
  );

  // 2. One mock series per sub-exam that has mocks
  for (const sub of focus.subCategories) {
    const mocks = await Exam.find({
      subCategory: sub._id,
      isLiveMock: { $ne: true },
      status: { $in: ['scheduled', 'active'] },
      tags: 'test-content',
      ...notDeleted,
    })
      .sort({ title: 1 })
      .select('_id duration')
      .lean();
    if (!mocks.length) continue;
    await upsertSeries(
      `${sub.name} Mock Series`,
      {
        ...base,
        subCategory: sub._id,
        seriesType: 'mock',
        description: `Full mocks in the ${sub.name} pattern — Haryana GK, Maths, Reasoning, GK and more, in English and Hindi.`,
        estimatedDuration: Math.max(1, Math.round(mocks.reduce((n, m) => n + (m.duration || 0), 0) / 60)),
      },
      mocks.map((m) => m._id)
    );
  }

  // 3. Weekly live mocks
  if (APPLY) await syncLiveMockSeries();
  else console.log(`  ${LIVE_SERIES_TITLE}: synced on --apply`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
