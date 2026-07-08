import mongoose from 'mongoose';

const connectDB = async () => {
  const isProd = process.env.NODE_ENV === 'production';
  const mongoUri = process.env.MONGODB_URI;

  // In production/serverless, fail fast with a clear message.
  if (isProd && !mongoUri) {
    throw new Error('MONGODB_URI is missing in production environment');
  }

  try {
    const conn = await mongoose.connect(mongoUri || 'mongodb://localhost:27017/goprep');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    if (error.message.includes('bad auth')) {
      console.error('Hint: Atlas username/password may be wrong. For local dev use MONGODB_URI=mongodb://localhost:27017/goprep');
    }
    // Throw instead of exiting the process so hosting platforms can surface logs.
    throw error;
  }
};

export default connectDB;

