/**
 * Seed sample HSSC PYQ questions for local/demo testing.
 * Usage: node scripts/seedHsscPyq.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Category from '../models/Category.js';
import Question from '../models/Question.js';

dotenv.config();

const HSSC_CODE = 'HSSC';

const SAMPLE_PYQS = [
  {
    sourceYear: 2024,
    subject: 'Haryana GK',
    topic: 'Geography',
    difficulty: 'Easy',
    questionText: 'Which district of Haryana is known as the “City of Weavers”?',
    correctAnswer: 'B',
    options: [
      { optionLabel: 'A', optionText: 'Hisar' },
      { optionLabel: 'B', optionText: 'Panipat' },
      { optionLabel: 'C', optionText: 'Rohtak' },
      { optionLabel: 'D', optionText: 'Karnal' },
    ],
    explanation: 'Panipat is famous for handloom and textile industries and is often called the City of Weavers.',
  },
  {
    sourceYear: 2024,
    subject: 'Haryana GK',
    topic: 'History',
    difficulty: 'Medium',
    questionText: 'The Battle of Panipat (1761) was fought between the Marathas and which force?',
    correctAnswer: 'C',
    options: [
      { optionLabel: 'A', optionText: 'Mughal Empire under Aurangzeb' },
      { optionLabel: 'B', optionText: 'British East India Company' },
      { optionLabel: 'C', optionText: 'Ahmad Shah Abdali' },
      { optionLabel: 'D', optionText: 'Tipu Sultan' },
    ],
    explanation: 'The Third Battle of Panipat (1761) was fought between the Maratha Empire and Ahmad Shah Abdali.',
  },
  {
    sourceYear: 2024,
    subject: 'Reasoning',
    topic: 'Series',
    difficulty: 'Easy',
    questionText: 'Find the next number in the series: 2, 6, 12, 20, 30, ?',
    correctAnswer: 'A',
    options: [
      { optionLabel: 'A', optionText: '42' },
      { optionLabel: 'B', optionText: '40' },
      { optionLabel: 'C', optionText: '36' },
      { optionLabel: 'D', optionText: '44' },
    ],
    explanation: 'Pattern: +4, +6, +8, +10, +12 → next is 30+12 = 42.',
  },
  {
    sourceYear: 2024,
    subject: 'Quantitative Aptitude',
    topic: 'Percentage',
    difficulty: 'Medium',
    questionText: 'If 40% of a number is 240, what is 15% of that number?',
    correctAnswer: 'D',
    options: [
      { optionLabel: 'A', optionText: '60' },
      { optionLabel: 'B', optionText: '72' },
      { optionLabel: 'C', optionText: '80' },
      { optionLabel: 'D', optionText: '90' },
    ],
    explanation: 'Number = 240 / 0.4 = 600. 15% of 600 = 90.',
  },
  {
    sourceYear: 2023,
    subject: 'Haryana GK',
    topic: 'Polity',
    difficulty: 'Easy',
    questionText: 'Who is the constitutional head of the state of Haryana?',
    correctAnswer: 'B',
    options: [
      { optionLabel: 'A', optionText: 'Chief Minister' },
      { optionLabel: 'B', optionText: 'Governor' },
      { optionLabel: 'C', optionText: 'Speaker of Vidhan Sabha' },
      { optionLabel: 'D', optionText: 'Chief Justice of Punjab & Haryana High Court' },
    ],
    explanation: 'The Governor is the constitutional head of a state in India.',
  },
  {
    sourceYear: 2023,
    subject: 'Haryana GK',
    topic: 'Economy',
    difficulty: 'Medium',
    questionText: 'Which of the following is a major industrial hub of Haryana?',
    correctAnswer: 'A',
    options: [
      { optionLabel: 'A', optionText: 'Gurugram' },
      { optionLabel: 'B', optionText: 'Nuh' },
      { optionLabel: 'C', optionText: 'Fatehabad' },
      { optionLabel: 'D', optionText: 'Charkhi Dadri' },
    ],
    explanation: 'Gurugram (Gurgaon) is one of Haryana’s major industrial and IT hubs.',
  },
  {
    sourceYear: 2023,
    subject: 'English',
    topic: 'Synonyms',
    difficulty: 'Easy',
    questionText: 'Choose the synonym of “Abundant”.',
    correctAnswer: 'C',
    options: [
      { optionLabel: 'A', optionText: 'Scarce' },
      { optionLabel: 'B', optionText: 'Meagre' },
      { optionLabel: 'C', optionText: 'Plentiful' },
      { optionLabel: 'D', optionText: 'Insufficient' },
    ],
    explanation: 'Abundant means existing in large quantities; plentiful is a synonym.',
  },
  {
    sourceYear: 2023,
    subject: 'General Science',
    topic: 'Physics',
    difficulty: 'Easy',
    questionText: 'The SI unit of electric current is:',
    correctAnswer: 'A',
    options: [
      { optionLabel: 'A', optionText: 'Ampere' },
      { optionLabel: 'B', optionText: 'Volt' },
      { optionLabel: 'C', optionText: 'Ohm' },
      { optionLabel: 'D', optionText: 'Watt' },
    ],
    explanation: 'Electric current is measured in ampere (A) in the SI system.',
  },
  {
    sourceYear: 2022,
    subject: 'Haryana GK',
    topic: 'Culture',
    difficulty: 'Medium',
    questionText: 'Which folk dance is traditionally associated with Haryana?',
    correctAnswer: 'B',
    options: [
      { optionLabel: 'A', optionText: 'Bihu' },
      { optionLabel: 'B', optionText: 'Ghoomar / Phag' },
      { optionLabel: 'C', optionText: 'Lavani' },
      { optionLabel: 'D', optionText: 'Kathakali' },
    ],
    explanation: 'Phag and related folk forms are associated with Haryana’s cultural traditions.',
  },
  {
    sourceYear: 2022,
    subject: 'Reasoning',
    topic: 'Coding-Decoding',
    difficulty: 'Medium',
    questionText: 'If CAT = 24 and DOG = 26, then RAT = ?',
    correctAnswer: 'C',
    options: [
      { optionLabel: 'A', optionText: '36' },
      { optionLabel: 'B', optionText: '38' },
      { optionLabel: 'C', optionText: '39' },
      { optionLabel: 'D', optionText: '40' },
    ],
    explanation: 'Sum of positions: C=3,A=1,T=20 → 24; D=4,O=15,G=7 → 26; R=18,A=1,T=20 → 39.',
  },
];

async function run() {
  await connectDB();

  const category = await Category.findOne({
    $or: [{ code: HSSC_CODE }, { name: /^HSSC$/i }],
  });
  if (!category) {
    console.error('HSSC category not found. Aborting.');
    process.exit(1);
  }

  console.log('Using category:', category.name, category._id.toString());

  // Tag up to 8 existing HSSC questions as PYQ (spread across years)
  const existing = await Question.find({ category: category._id })
    .select('_id isPYQ')
    .limit(8)
    .lean();

  let tagged = 0;
  const yearsCycle = [2024, 2024, 2023, 2023, 2022, 2022, 2024, 2023];
  for (let i = 0; i < existing.length; i++) {
    const res = await Question.updateOne(
      { _id: existing[i]._id },
      {
        $set: {
          isPYQ: true,
          sourceExam: 'HSSC',
          sourceYear: yearsCycle[i] || 2023,
          status: 'Published',
        },
      }
    );
    if (res.modifiedCount) tagged += 1;
  }
  console.log(`Tagged existing HSSC questions as PYQ: ${tagged}`);

  // Insert new sample PYQs (skip if identical questionText already exists for HSSC)
  let inserted = 0;
  for (const sample of SAMPLE_PYQS) {
    const exists = await Question.findOne({
      category: category._id,
      questionText: sample.questionText,
    }).select('_id');
    if (exists) {
      await Question.updateOne(
        { _id: exists._id },
        {
          $set: {
            isPYQ: true,
            sourceExam: 'HSSC',
            sourceYear: sample.sourceYear,
            status: 'Published',
          },
        }
      );
      continue;
    }

    await Question.create({
      questionText: sample.questionText,
      questionType: 'MCQ',
      options: sample.options.map((o) => ({
        optionLabel: o.optionLabel,
        optionText: o.optionText,
        isCorrect: o.optionLabel === sample.correctAnswer,
      })),
      correctAnswer: sample.correctAnswer,
      explanation: sample.explanation,
      category: category._id,
      subject: sample.subject,
      topic: sample.topic,
      difficulty: sample.difficulty,
      marks: 1,
      language: 'English',
      status: 'Published',
      publishedAt: new Date(),
      isPYQ: true,
      sourceExam: 'HSSC',
      sourceYear: sample.sourceYear,
    });
    inserted += 1;
  }
  console.log(`Inserted new HSSC PYQ questions: ${inserted}`);

  const summary = await Question.aggregate([
    {
      $match: {
        isPYQ: true,
        sourceExam: { $regex: /^HSSC$/i },
      },
    },
    { $group: { _id: '$sourceYear', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);
  console.log('HSSC PYQ by year:', summary);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
