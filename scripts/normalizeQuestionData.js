// One-time clean-up of question subjects and Haryana GK topics.
//   node scripts/normalizeQuestionData.js            → preview only (no writes)
//   node scripts/normalizeQuestionData.js --apply    → write changes
//
// 1. Subjects: trim, and merge case/spelling variants ("haryana gk ", "Math",
//    "maths" …) into one canonical name, on Question and SavedQuestion.
// 2. Haryana GK topics: map old ad-hoc topics onto the hub's topic list and
//    tag questions that had no topic (reviewed list below).
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Question from '../models/Question.js';
import SavedQuestion from '../models/SavedQuestion.js';
import { HARYANA_GK_SUBJECT } from '../utils/haryanaGk.js';

dotenv.config();
const APPLY = process.argv.includes('--apply');

const CANONICAL_SUBJECTS = {
  'haryana gk': HARYANA_GK_SUBJECT,
  math: 'Maths',
  maths: 'Maths',
  gk: 'General Knowledge',
  'general knowledge': 'General Knowledge',
  english: 'English',
  reasoning: 'Reasoning',
  science: 'Science',
  'indian geography': 'Indian Geography',
  'indian history': 'Indian History',
  'computer science': 'Computer Science',
};

const canonicalSubject = (raw) => {
  const trimmed = (raw || '').replace(/\s+/g, ' ').trim();
  return CANONICAL_SUBJECTS[trimmed.toLowerCase()] || trimmed;
};

// Old Haryana GK topics → hub topics.
const TOPIC_MAP = {
  sports: 'Sports & Personalities',
  'famous temple': 'Culture & Heritage',
  history: 'History',
  culture: 'Culture & Heritage',
  economy: 'Economy & Schemes',
  polity: 'Polity & Administration',
  geography: 'Geography & Districts',
};

// Untagged Haryana GK questions, classified by hand (ids from the 2026-10 audit).
const UNTAGGED_TOPICS = {
  '6910dda65d7e7f37ee6c4349': 'Geography & Districts', // rivers not in Haryana
  '6910dda65d7e7f37ee6c4376': 'Economy & Schemes', // automobile industry city
  '6910dda65d7e7f37ee6c4362': 'Geography & Districts', // Cyber City
  '6910dda65d7e7f37ee6c4367': 'History', // Battle of Panipat
  '6910dda65d7e7f37ee6c435d': 'Polity & Administration', // first Chief Minister
  '6910dda65d7e7f37ee6c4353': 'Culture & Heritage', // folk dance
  '6910dda65d7e7f37ee6c436c': 'Geography & Districts', // national parks
  '6910dda65d7e7f37ee6c434e': 'History', // Rakhigarhi
  '6910dda65d7e7f37ee6c4358': 'Culture & Heritage', // Surajkund Crafts Mela
  '6910e546463b7ecf27e6adae': 'Geography & Districts', // National Brain Research Centre
  '6910e546463b7ecf27e6adb8': 'Culture & Heritage', // Shiromani poet
  '6910e546463b7ecf27e6adbd': 'Geography & Districts', // Son Chiraiya tourist complex
  '6910e546463b7ecf27e6adc7': 'Economy & Schemes', // International Horticulture Market
  '6910e546463b7ecf27e6ada4': 'History', // Agnivedi archaeological site
  '6910e546463b7ecf27e6adb3': 'Economy & Schemes', // Beti Bachao Beti Padhao
  '6910e546463b7ecf27e6adcc': 'Geography & Districts', // Kalpana Chawla Planetarium
  '6910e546463b7ecf27e6ada9': 'Economy & Schemes', // Mukhyamantri Parivar Samridhi Yojana
  '6910e546463b7ecf27e6adc2': 'Geography & Districts', // Cyber City (Hindi)
  '6910e546463b7ecf27e6add1': 'Economy & Schemes', // Har Ghar Nal Se Jal
  '6912239812b8c96d5305c3f1': 'Geography & Districts', // Cyber City
  '6912239812b8c96d5305c3d6': 'Geography & Districts', // oldest canal
  '6912239812b8c96d5305c3df': 'Polity & Administration', // first Chief Minister
  '6912239812b8c96d5305c3cd': 'Culture & Heritage', // state bird
  '6912239812b8c96d5305c403': 'Geography & Districts', // Science City
  '6912239812b8c96d5305c3bb': 'Geography & Districts', // Badkhal Lake
  '6912239812b8c96d5305c3c4': 'Geography & Districts', // rivers not in Haryana
  '6912239812b8c96d5305c3e8': 'Geography & Districts', // Sultanpur National Park
  '6912239812b8c96d5305c3b2': 'Geography & Districts', // City of Weavers
  '6912239812b8c96d5305c3fa': 'Culture & Heritage', // state animal
  '6910dda65d7e7f37ee6c4371': 'Sports & Personalities', // Iron Man of Haryana
};

const run = async () => {
  await connectDB();
  console.log(APPLY ? '== APPLYING CHANGES ==' : '== PREVIEW (no writes; pass --apply) ==');

  // 1. Subjects (Question + SavedQuestion)
  for (const Model of [Question, SavedQuestion]) {
    const subjects = (await Model.distinct('subject')).filter((s) => typeof s === 'string');
    for (const raw of subjects) {
      const target = canonicalSubject(raw);
      if (target === raw) continue;
      const n = await Model.countDocuments({ subject: raw });
      console.log(`  ${Model.modelName}: subject ${JSON.stringify(raw)} → ${JSON.stringify(target)} (${n})`);
      if (APPLY) await Model.updateMany({ subject: raw }, { $set: { subject: target } });
    }
  }

  // 2. Haryana GK topics
  const subjectFilter = APPLY ? { subject: HARYANA_GK_SUBJECT } : { subject: /^\s*haryana gk\s*$/i };
  const hr = await Question.find(subjectFilter).select('topic').lean();
  let mapped = 0;
  let tagged = 0;
  const unknown = new Set();
  for (const q of hr) {
    const current = (q.topic || '').trim();
    let target = null;
    if (!current) target = UNTAGGED_TOPICS[String(q._id)] || null;
    else if (TOPIC_MAP[current.toLowerCase()]) target = TOPIC_MAP[current.toLowerCase()];
    if (!target) {
      if (current && !Object.values(TOPIC_MAP).includes(current)) unknown.add(current);
      continue;
    }
    if (target === current) continue;
    current ? mapped++ : tagged++;
    if (APPLY) {
      await Question.updateOne({ _id: q._id }, { $set: { topic: target } });
      await SavedQuestion.updateMany({ question: q._id }, { $set: { topic: target } });
    }
  }
  console.log(`  Haryana GK: ${mapped} topics remapped, ${tagged} untagged questions tagged`);
  if (unknown.size) console.log('  Unmapped existing topics (left as is):', [...unknown]);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Normalize failed:', err.message);
  process.exit(1);
});
