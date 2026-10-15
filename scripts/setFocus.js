// Show or change focus mode (see utils/focus.js).
//   node scripts/setFocus.js          → show current focus
//   node scripts/setFocus.js HSSC     → focus on HSSC (top-level category name or id)
//   node scripts/setFocus.js off      → show every category again
// Running servers pick the change up within a minute.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import AppSettings from '../models/AppSettings.js';
import { FOCUS_SETTING_KEY, getFocus, clearFocusCache } from '../utils/focus.js';

dotenv.config();
const arg = process.argv[2];

const run = async () => {
  await connectDB();
  if (arg) {
    const value = arg.toLowerCase() === 'off' ? '' : arg;
    await AppSettings.findOneAndUpdate(
      { key: FOCUS_SETTING_KEY },
      {
        $set: {
          value,
          dataType: 'string',
          category: 'features',
          isPublic: true,
          description: 'Top-level category the product is focused on ("" = all categories)',
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    clearFocusCache();
  }
  const focus = await getFocus();
  if (arg && arg.toLowerCase() !== 'off' && !focus) console.log(`No top-level category matches "${arg}".`);
  console.log(
    focus
      ? `Focus: ${focus.name} (+ ${focus.subCategories.map((c) => c.name).join(', ') || 'no sub-categories'})`
      : 'Focus: off (all categories)'
  );
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('setFocus failed:', err.message);
  process.exit(1);
});
