import mongoose from 'mongoose';

let connectingPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/goprep';

  connectingPromise = mongoose
    .connect(mongoUri)
    .then((conn) => {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((error) => {
      console.error(`MongoDB connection failed: ${error.message}`);
      throw error;
    })
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
};

export default connectDB;
