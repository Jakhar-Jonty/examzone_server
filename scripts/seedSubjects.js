import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';

dotenv.config();

const seedSubjects = async () => {
  await connectDB();

  try {
    console.log('Seeding default subjects...');

    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('Admin user not found. Please run seedAdmin.js first.');
      return;
    }

    const defaultSubjects = [
      {
        name: 'MATH',
        displayName: 'Mathematics',
        description: 'Quantitative Aptitude and Mathematics',
        icon: '📐',
        color: '#3b82f6',
        order: 1
      },
      {
        name: 'ENGLISH',
        displayName: 'English',
        description: 'English Language and Comprehension',
        icon: '📚',
        color: '#10b981',
        order: 2
      },
      {
        name: 'REASONING',
        displayName: 'Reasoning',
        description: 'Logical Reasoning and Analytical Ability',
        icon: '🧩',
        color: '#f59e0b',
        order: 3
      },
      {
        name: 'GENERAL_KNOWLEDGE',
        displayName: 'General Knowledge',
        description: 'Current Affairs and General Knowledge',
        icon: '🌍',
        color: '#8b5cf6',
        order: 4
      },
      {
        name: 'GENERAL_SCIENCE',
        displayName: 'General Science',
        description: 'Physics, Chemistry, Biology',
        icon: '🔬',
        color: '#ec4899',
        order: 5
      },
      {
        name: 'HISTORY',
        displayName: 'History',
        description: 'Indian History and World History',
        icon: '📜',
        color: '#ef4444',
        order: 6
      },
      {
        name: 'GEOGRAPHY',
        displayName: 'Geography',
        description: 'Indian Geography and World Geography',
        icon: '🗺️',
        color: '#06b6d4',
        order: 7
      },
      {
        name: 'POLITY',
        displayName: 'Polity',
        description: 'Indian Constitution and Political Science',
        icon: '🏛️',
        color: '#84cc16',
        order: 8
      },
      {
        name: 'ECONOMICS',
        displayName: 'Economics',
        description: 'Indian Economy and Economic Concepts',
        icon: '💰',
        color: '#f97316',
        order: 9
      },
      {
        name: 'COMPUTER',
        displayName: 'Computer Science',
        description: 'Computer Fundamentals and IT',
        icon: '💻',
        color: '#6366f1',
        order: 10
      },
      {
        name: 'HINDI',
        displayName: 'Hindi',
        description: 'Hindi Language and Literature',
        icon: '📖',
        color: '#14b8a6',
        order: 11
      }
    ];

    for (const subjectData of defaultSubjects) {
      let subject = await Subject.findOne({ name: subjectData.name });
      if (subject) {
        // Update existing subject
        subject.displayName = subjectData.displayName;
        subject.description = subjectData.description;
        subject.icon = subjectData.icon;
        subject.color = subjectData.color;
        subject.order = subjectData.order;
        subject.createdBy = adminUser._id;
        await subject.save();
        console.log(`Updated subject: ${subject.name}`);
      } else {
        // Create new subject
        subject = new Subject({
          ...subjectData,
          createdBy: adminUser._id
        });
        await subject.save();
        console.log(`Created new subject: ${subject.name}`);
      }
    }

    console.log('Subject seeding complete.');
  } catch (error) {
    console.error('Error seeding subjects:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedSubjects();

