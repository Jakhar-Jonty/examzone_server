import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  console.log('SUCCESS');
  console.log('Host:', mongoose.connection.host);
  console.log('Database:', mongoose.connection.name);
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error('FAILED:', error.message);
  process.exit(1);
}
