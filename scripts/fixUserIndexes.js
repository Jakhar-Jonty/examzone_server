// Fix unique indexes on users so optional fields can be left empty:
//   node scripts/fixUserIndexes.js            → preview
//   node scripts/fixUserIndexes.js --apply    → write
//
// The old phoneNumber index was unique but not sparse, so only ONE account
// could ever have no phone ("number already used" for the next one). Mongoose
// never alters an existing index, so this rebuilds them as partial indexes that
// only cover real string values. Email gets the same treatment once there are
// no duplicate emails left.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

dotenv.config();
const APPLY = process.argv.includes('--apply');

const fixField = async (users, field) => {
  const indexes = await users.indexes();
  const old = indexes.find((i) => Object.keys(i.key).length === 1 && i.key[field] === 1 && i.unique);
  const wanted = `${field}_unique_when_set`;
  if (old?.name === wanted) {
    console.log(`  ${field}: already a partial unique index`);
    return;
  }

  const dups = await users
    .aggregate([
      { $match: { [field]: { $type: 'string' } } },
      { $group: { _id: field === 'email' ? { $toLower: `$${field}` } : `$${field}`, n: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  if (dups.length) {
    console.log(`  ${field}: SKIPPED — duplicate values must be resolved first:`);
    dups.forEach((d) => console.log(`    ${d._id} → ${d.ids.join(', ')}`));
    return;
  }

  const empties = await users.countDocuments({ $or: [{ [field]: null }, { [field]: '' }], [field]: { $exists: true } });
  console.log(`  ${field}: ${old ? `drop ${old.name}, ` : ''}unset ${empties} empty value(s), create ${wanted}`);
  if (!APPLY) return;
  if (old) await users.dropIndex(old.name);
  await users.updateMany({ $or: [{ [field]: null }, { [field]: '' }] }, { $unset: { [field]: '' } });
  await users.createIndex(
    { [field]: 1 },
    { name: wanted, unique: true, partialFilterExpression: { [field]: { $type: 'string' } } }
  );
};

const run = async () => {
  await connectDB();
  console.log(APPLY ? '== APPLYING ==' : '== PREVIEW (pass --apply) ==');
  const users = mongoose.connection.db.collection('users');
  await fixField(users, 'phoneNumber');
  await fixField(users, 'email');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('fixUserIndexes failed:', err.message);
  process.exit(1);
});
