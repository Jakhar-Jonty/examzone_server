import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminPhone = process.env.ADMIN_PHONE || '1234567890';
    const adminName = process.env.ADMIN_NAME || 'Admin User';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@goprep.com';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ phoneNumber: adminPhone });
    
    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log('Admin user already exists');
        process.exit(0);
      } else {
        // Update existing user to admin
        existingAdmin.role = 'admin';
        existingAdmin.subscriptionStatus = 'premium';
        await existingAdmin.save();
        console.log('Existing user updated to admin');
        process.exit(0);
      }
    }

    // Create new admin user
    const admin = new User({
      phoneNumber: adminPhone,
      name: adminName,
      email: adminEmail,
      role: 'admin',
      subscriptionStatus: 'premium',
      examPreparations: ['SSC', 'Banking', 'HSSC'],
      preferredLanguage: 'English',
      isVerified: true,
    });

    await admin.save();
    console.log('Admin user created successfully!');
    console.log(`Phone: ${adminPhone}`);
    console.log(`Name: ${adminName}`);
    console.log('You can now login with this phone number using OTP: 123456');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();

