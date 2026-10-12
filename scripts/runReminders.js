// Run a reminder job by hand (testing, or a one-off resend).
//   node scripts/runReminders.js <daily-quiz|streak|live-tests> [--user <userId>]... [--dry-run]
// --dry-run counts recipients and shows a sample without sending anything.
// --user limits the run to specific users (repeatable).
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { REMINDER_JOBS } from '../utils/reminders.js';

dotenv.config();

const args = process.argv.slice(2);
const jobName = args[0];
const dryRun = args.includes('--dry-run');
const userIds = args.flatMap((a, i) => (a === '--user' && args[i + 1] ? [args[i + 1]] : []));

const job = REMINDER_JOBS[jobName];
if (!job) {
  console.error(`Usage: node scripts/runReminders.js <${Object.keys(REMINDER_JOBS).join('|')}> [--user <id>] [--dry-run]`);
  process.exit(1);
}

try {
  await connectDB();
  const result = await job({ userIds: userIds.length ? userIds : undefined, dryRun });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Reminder run failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
