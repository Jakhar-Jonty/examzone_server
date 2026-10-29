// Draft current affairs from the latest PIB releases right now (same job the
// scheduler runs at 7:00 and 18:00 IST). Drafts appear in Admin → Current Affairs.
//   node scripts/draftCurrentAffairs.js [count]     (default 2)
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { autoDraftCurrentAffairs } from '../utils/currentAffairsAutoDraft.js';

dotenv.config();
const max = Math.min(10, Math.max(1, parseInt(process.argv[2], 10) || 2));

const run = async () => {
  await connectDB();
  const result = await autoDraftCurrentAffairs({ max });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('draftCurrentAffairs failed:', err.message);
  process.exit(1);
});
