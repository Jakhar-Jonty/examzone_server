import mongoose from 'mongoose';

let cachedConnection = null;
let connectingPromise = null;

const isDeployed =
  process.env.VERCEL === '1' ||
  process.env.NODE_ENV === 'production';

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  const mongoUri = process.env.MONGODB_URI?.trim();

  if (isDeployed && !mongoUri) {
    throw new Error('MONGODB_URI is not set in Vercel environment variables');
  }

  const uri = mongoUri || 'mongodb://localhost:27017/goprep';

  connectingPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false,
    })
    .then((conn) => {
      cachedConnection = conn;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((error) => {
      console.error(`MongoDB connection failed: ${error.message}`);
      if (error.message.includes('bad auth')) {
        console.error('Hint: check Atlas username/password in MONGODB_URI');
      }
      if (error.message.includes('timed out') || error.message.includes('ENOTFOUND')) {
        console.error('Hint: allow 0.0.0.0/0 in Atlas Network Access for Vercel');
      }
      throw error;
    })
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
};

export default connectDB;
