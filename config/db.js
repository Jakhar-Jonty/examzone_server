import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/goprep');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    if (error.message.includes('bad auth')) {
      console.error('Hint: Atlas username/password may be wrong. For local dev use MONGODB_URI=mongodb://localhost:27017/goprep');
    }
    process.exit(1);
  }
};

export default connectDB;

