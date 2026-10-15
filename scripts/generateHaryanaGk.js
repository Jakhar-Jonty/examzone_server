// Batch-generate Haryana GK questions into the admin review queue (status
// "UnderReview" — students see them only after approval).
//   node scripts/generateHaryanaGk.js                 → 15 per topic, all topics
//   node scripts/generateHaryanaGk.js history 20      → one topic
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { HARYANA_GK_TOPICS } from '../utils/haryanaGk.js';
import { createHaryanaGkDrafts } from '../controllers/questionReviewController.js';

dotenv.config();
const [topicArg, countArg] = process.argv.slice(2);
const count = Math.min(20, Math.max(5, parseInt(countArg, 10) || 15));
const topics = HARYANA_GK_TOPICS.filter((t) => t.key !== 'current-affairs' && (!topicArg || t.key === topicArg));

const run = async () => {
  if (!topics.length) throw new Error(`Unknown topic "${topicArg}". Use one of: ${HARYANA_GK_TOPICS.map((t) => t.key).join(', ')}`);
  await connectDB();
  for (const topic of topics) {
    try {
      const created = await createHaryanaGkDrafts({ topic, count });
      console.log(`${topic.label}: ${created.length} drafts queued`);
    } catch (err) {
      console.log(`${topic.label}: failed — ${err.message}`);
    }
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
