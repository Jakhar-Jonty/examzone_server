import mongoose from 'mongoose';

let cachedConnection = null;
let connectingPromise = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const mongoUri = process.env.MONGODB_URI;

  // In production/serverless, fail fast with a clear message.
  if (isProd && !mongoUri) {
    throw new Error('MONGODB_URI is missing in production environment');
  }

  connectingPromise = mongoose
    .connect(mongoUri || 'mongodb://localhost:27017/goprep')
    .then((conn) => {
      cachedConnection = conn;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((error) => {
      console.error(`MongoDB connection failed: ${error.message}`);
      if (error.message.includes('bad auth')) {
        console.error('Hint: Atlas username/password may be wrong. For local dev use MONGODB_URI=mongodb://localhost:27017/goprep');
      }
      throw error;
    })
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
};

export default connectDB;

