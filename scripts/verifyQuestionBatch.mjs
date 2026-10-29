// Check that inserted questions match their batch file (answer in English and Hindi):
//   node scripts/verifyQuestionBatch.mjs content/maths/2026-10-30.json::maths-2026-10-30 [more file::tag ...]
import dotenv from 'dotenv'; import mongoose from 'mongoose'; import fs from 'fs';
dotenv.config(); await mongoose.connect(process.env.MONGODB_URI); const L='ABCD';
for (const pair of process.argv.slice(2)) {
  const [f, tag] = pair.split('::');
  const rows = JSON.parse(fs.readFileSync(f,'utf8')); const docs = await mongoose.connection.db.collection('questions').find({ tags: tag }).toArray(); let bad=0;
  for (const r of rows) { const d = docs.find(x => x.questionText === r[2] && x.questionTextHindi === r[3]); if (!d) { bad++; console.log('MISSING', r[2]); continue; } const i = L.indexOf(d.correctAnswer);
    if (d.options[i].optionText !== r[4][r[6]] || d.optionsHindi[i].optionText !== r[5][r[6]] || d.options.filter(o=>o.isCorrect).length !== 1) { bad++; console.log('MISMATCH', r[2]); } }
  console.log(tag, 'verified', docs.length, 'mismatches', bad);
}
await mongoose.disconnect();
