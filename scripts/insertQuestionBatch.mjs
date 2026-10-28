// Insert a reviewed batch of bilingual questions (dry run unless --apply):
//   node scripts/insertQuestionBatch.mjs content/haryana-gk/2026-10-28.json hgk-2026-10-28 [--apply]
// Checks shape and near-duplicates against the bank, and spreads the correct answer evenly over A-D.
// rows: [topic, difficulty, q, qHindi, [4 options], [4 Hindi options], correctIndex, explanation, explanationHindi]
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();
const [,, file, batchTag, flag] = process.argv; const APPLY = flag === '--apply';
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
await mongoose.connect(process.env.MONGODB_URI); const db = mongoose.connection.db;
const hssc = await db.collection('categories').findOne({ name: /^hssc$/i, parentCategory: null }, { projection: { _id: 1 } });
const L = ['A', 'B', 'C', 'D'];
const STOP = new Set(['which','what','where','whom','haryana','district','state','famous','following','known','located','called','first','india','indian','their','there','this','that','with','from','into','about','after','before','city','year','name']);
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
const existing = (await db.collection('questions').find({ status: { $ne: 'Archived' } }, { projection: { questionText: 1 } }).toArray()).map((q) => ({ t: q.questionText, w: words(q.questionText) }));
const sim = (a, b) => { if (Math.min(a.size, b.size) < 2) return 0; let n = 0; a.forEach((w) => b.has(w) && n++); return n / Math.min(a.size, b.size); };
let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const docs = []; const problems = [];
rows.forEach((r, i) => {
  const [topic, difficulty, q, qh, o, oh, ci, e, eh] = r;
  if (o.length !== 4 || oh.length !== 4 || !q || !qh || ci < 0 || ci > 3) problems.push(`#${i + 1} malformed`);
  const w = words(q); const dup = existing.find((x) => sim(w, x.w) >= 0.75);
  if (dup) problems.push(`#${i + 1} similar to existing: "${dup.t.slice(0, 80)}"`);
  // correct answer lands on A, C, B, D, A, ... so the spread is even
  const target = [0, 2, 1, 3][i % 4]; const others = [0, 1, 2, 3].filter((k) => k !== ci);
  const order = [...others]; order.splice(target, 0, ci);
  const correct = order.indexOf(ci);
  docs.push({
    questionText: q, questionTextHindi: qh, questionType: 'MCQ',
    options: order.map((k, j) => ({ optionText: o[k], optionLabel: L[j], isCorrect: j === correct })),
    optionsHindi: order.map((k, j) => ({ optionText: oh[k], optionLabel: L[j] })),
    correctAnswer: L[correct], explanation: e, explanationHindi: eh,
    category: hssc._id, subject: 'Haryana GK', topic, difficulty, language: 'Both',
    isAIGenerated: true, humanVerified: false, status: 'Published', publishedAt: new Date(),
    marks: 1, negativeMarking: 0, flags: [], tags: ['haryana-gk', 'claude-authored', batchTag],
    createdAt: new Date(), updatedAt: new Date(),
  });
});
const dist = {}; docs.forEach((d) => (dist[d.correctAnswer] = (dist[d.correctAnswer] || 0) + 1));
const byTopic = {}; docs.forEach((d) => (byTopic[d.topic] = (byTopic[d.topic] || 0) + 1));
console.log('questions:', docs.length, '| answers', JSON.stringify(dist), '| topics', JSON.stringify(byTopic));
problems.forEach((p) => console.log('  !', p));
if (APPLY) {
  const res = await db.collection('questions').insertMany(docs);
  console.log('inserted', res.insertedCount, 'with tag', batchTag);
} else console.log('DRY RUN');
await mongoose.disconnect();
