import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Question from '../models/Question.js';
import Exam from '../models/Exam.js';
import Category from '../models/Category.js';
import connectDB from '../config/db.js';

dotenv.config();

const migrateToHierarchy = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // First, ensure categories exist (run seedCategories.js first if needed)
    const sscCategory = await Category.findOne({ code: 'SSC' });
    const bankingCategory = await Category.findOne({ code: 'BANKING' });
    const hsscCategory = await Category.findOne({ code: 'HSSC' });

    if (!sscCategory || !bankingCategory || !hsscCategory) {
      console.log('⚠️  Warning: Some categories not found. Please run seedCategories.js first.');
      console.log('Creating basic categories...');
      
      // Create basic categories if they don't exist
      if (!sscCategory) {
        const newSSC = new Category({ name: 'SSC', code: 'SSC', description: 'Staff Selection Commission' });
        await newSSC.save();
        console.log('Created SSC category');
      }
      if (!bankingCategory) {
        const newBanking = new Category({ name: 'Banking', code: 'BANKING', description: 'Banking Exams' });
        await newBanking.save();
        console.log('Created Banking category');
      }
      if (!hsscCategory) {
        const newHSSC = new Category({ name: 'HSSC', code: 'HSSC', description: 'Haryana Staff Selection Commission' });
        await newHSSC.save();
        console.log('Created HSSC category');
      }
    }

    // Get categories again after creation
    const ssc = await Category.findOne({ code: 'SSC' });
    const banking = await Category.findOne({ code: 'BANKING' });
    const hssc = await Category.findOne({ code: 'HSSC' });

    // Create mapping from old enum values to new category IDs
    const categoryMap = {
      'SSC': ssc._id,
      'Banking': banking._id,
      'HSSC': hssc._id
    };

    // Migrate Questions
    console.log('\n📝 Migrating Questions...');
    const questions = await Question.find({
      $or: [
        { category: { $type: 'string' } }, // Old string category
        { category: { $exists: false } } // No category field
      ]
    });

    console.log(`Found ${questions.length} questions to migrate`);

    let migratedCount = 0;
    for (const question of questions) {
      try {
        // Check if question has old string category
        if (typeof question.category === 'string') {
          const oldCategory = question.category;
          const newCategoryId = categoryMap[oldCategory];
          
          if (newCategoryId) {
            question.category = newCategoryId;
            // Set questionType to MCQ if not set (for backward compatibility)
            if (!question.questionType) {
              question.questionType = 'MCQ';
            }
            await question.save();
            migratedCount++;
          } else {
            console.log(`⚠️  Unknown category "${oldCategory}" for question ${question._id}`);
          }
        }
      } catch (error) {
        console.error(`Error migrating question ${question._id}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${migratedCount} questions`);

    // Migrate Exams
    console.log('\n📝 Migrating Exams...');
    const exams = await Exam.find({
      $or: [
        { category: { $type: 'string' } }, // Old string category
        { category: { $exists: false } } // No category field
      ]
    });

    console.log(`Found ${exams.length} exams to migrate`);

    let migratedExamCount = 0;
    for (const exam of exams) {
      try {
        // Check if exam has old string category
        if (typeof exam.category === 'string') {
          const oldCategory = exam.category;
          const newCategoryId = categoryMap[oldCategory];
          
          if (newCategoryId) {
            exam.category = newCategoryId;
            // Set examPattern to Single if not set
            if (!exam.examPattern) {
              exam.examPattern = 'Single';
            }
            await exam.save();
            migratedExamCount++;
          } else {
            console.log(`⚠️  Unknown category "${oldCategory}" for exam ${exam._id}`);
          }
        }
      } catch (error) {
        console.error(`Error migrating exam ${exam._id}:`, error.message);
      }
    }

    console.log(`✅ Migrated ${migratedExamCount} exams`);

    console.log('\n✅ Migration completed successfully!');
    console.log(`\nSummary:`);
    console.log(`- Questions migrated: ${migratedCount}`);
    console.log(`- Exams migrated: ${migratedExamCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
};

migrateToHierarchy();


