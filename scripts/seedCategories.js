import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';
import Tier from '../models/Tier.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedCategories = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // Clear existing categories and tiers (optional - comment out if you want to keep existing data)
    // await Category.deleteMany({});
    // await Tier.deleteMany({});
    // console.log('Cleared existing categories and tiers');

    // Create top-level categories
    const categoriesData = [
      { name: 'SSC', code: 'SSC', description: 'Staff Selection Commission', color: '#3b82f6', order: 1 },
      { name: 'UPSC', code: 'UPSC', description: 'Union Public Service Commission', color: '#10b981', order: 2 },
      { name: 'Railway', code: 'RAILWAY', description: 'Railway Recruitment Board', color: '#f59e0b', order: 3 },
      { name: 'Banking', code: 'BANKING', description: 'Banking Exams (IBPS, SBI)', color: '#8b5cf6', order: 4 },
      { name: 'State PSC', code: 'STATE_PSC', description: 'State Public Service Commission', color: '#ef4444', order: 5 },
      { name: 'Defense', code: 'DEFENSE', description: 'Defense Exams (NDA, CDS)', color: '#06b6d4', order: 6 },
      { name: 'Teaching', code: 'TEACHING', description: 'Teaching Exams (CTET, TET)', color: '#ec4899', order: 7 },
      { name: 'Other Central', code: 'OTHER_CENTRAL', description: 'Other Central Government Exams', color: '#6366f1', order: 8 },
    ];

    const createdCategories = {};
    for (const catData of categoriesData) {
      let category = await Category.findOne({ code: catData.code });
      if (!category) {
        category = new Category(catData);
        await category.save();
        console.log(`Created category: ${category.name}`);
      } else {
        console.log(`Category already exists: ${category.name}`);
      }
      createdCategories[catData.code] = category;
    }

    // Create sub-categories for SSC
    const sscSubCategories = [
      { name: 'CGL', code: 'SSC_CGL', description: 'Combined Graduate Level', color: '#60a5fa', order: 1 },
      { name: 'CHSL', code: 'SSC_CHSL', description: 'Combined Higher Secondary Level', color: '#60a5fa', order: 2 },
      { name: 'MTS', code: 'SSC_MTS', description: 'Multi Tasking Staff', color: '#60a5fa', order: 3 },
      { name: 'GD', code: 'SSC_GD', description: 'General Duty', color: '#60a5fa', order: 4 },
      { name: 'JE', code: 'SSC_JE', description: 'Junior Engineer', color: '#60a5fa', order: 5 },
    ];

    for (const subCatData of sscSubCategories) {
      let subCategory = await Category.findOne({ code: subCatData.code });
      if (!subCategory) {
        subCategory = new Category({
          ...subCatData,
          parentCategory: createdCategories['SSC']._id
        });
        await subCategory.save();
        console.log(`Created sub-category: ${subCategory.name} under SSC`);
      }
    }

    // Create sub-categories for UPSC
    const upscSubCategories = [
      { name: 'Prelims', code: 'UPSC_PRELIMS', description: 'UPSC Preliminary Examination', color: '#34d399', order: 1 },
      { name: 'Mains', code: 'UPSC_MAINS', description: 'UPSC Main Examination', color: '#34d399', order: 2 },
      { name: 'Optional', code: 'UPSC_OPTIONAL', description: 'UPSC Optional Subjects', color: '#34d399', order: 3 },
    ];

    for (const subCatData of upscSubCategories) {
      let subCategory = await Category.findOne({ code: subCatData.code });
      if (!subCategory) {
        subCategory = new Category({
          ...subCatData,
          parentCategory: createdCategories['UPSC']._id
        });
        await subCategory.save();
        console.log(`Created sub-category: ${subCategory.name} under UPSC`);
      }
    }

    // Create sub-categories for Railway
    const railwaySubCategories = [
      { name: 'RRB NTPC', code: 'RRB_NTPC', description: 'Non-Technical Popular Categories', color: '#fbbf24', order: 1 },
      { name: 'RRB Group D', code: 'RRB_GROUP_D', description: 'Group D Posts', color: '#fbbf24', order: 2 },
      { name: 'RRB JE', code: 'RRB_JE', description: 'Junior Engineer', color: '#fbbf24', order: 3 },
    ];

    for (const subCatData of railwaySubCategories) {
      let subCategory = await Category.findOne({ code: subCatData.code });
      if (!subCategory) {
        subCategory = new Category({
          ...subCatData,
          parentCategory: createdCategories['Railway']._id
        });
        await subCategory.save();
        console.log(`Created sub-category: ${subCategory.name} under Railway`);
      }
    }

    // Create sub-categories for Banking
    const bankingSubCategories = [
      { name: 'IBPS PO', code: 'IBPS_PO', description: 'IBPS Probationary Officer', color: '#a78bfa', order: 1 },
      { name: 'SBI PO', code: 'SBI_PO', description: 'SBI Probationary Officer', color: '#a78bfa', order: 2 },
      { name: 'IBPS Clerk', code: 'IBPS_CLERK', description: 'IBPS Clerk', color: '#a78bfa', order: 3 },
      { name: 'SBI Clerk', code: 'SBI_CLERK', description: 'SBI Clerk', color: '#a78bfa', order: 4 },
    ];

    for (const subCatData of bankingSubCategories) {
      let subCategory = await Category.findOne({ code: subCatData.code });
      if (!subCategory) {
        subCategory = new Category({
          ...subCatData,
          parentCategory: createdCategories['Banking']._id
        });
        await subCategory.save();
        console.log(`Created sub-category: ${subCategory.name} under Banking`);
      }
    }

    // Create tiers for SSC CGL
    const sscCglCategory = await Category.findOne({ code: 'SSC_CGL' });
    if (sscCglCategory) {
      const sscCglTiers = [
        { name: 'Tier 1', code: 'TIER1', description: 'Tier 1 Examination', order: 1 },
        { name: 'Tier 2', code: 'TIER2', description: 'Tier 2 Examination', order: 2 },
      ];

      for (const tierData of sscCglTiers) {
        let tier = await Tier.findOne({ code: tierData.code, category: sscCglCategory._id });
        if (!tier) {
          tier = new Tier({
            ...tierData,
            category: createdCategories['SSC']._id,
            subCategory: sscCglCategory._id
          });
          await tier.save();
          console.log(`Created tier: ${tier.name} for SSC CGL`);
        }
      }
    }

    // Create tiers for UPSC Prelims
    const upscPrelimsCategory = await Category.findOne({ code: 'UPSC_PRELIMS' });
    if (upscPrelimsCategory) {
      const upscTiers = [
        { name: 'Paper 1', code: 'PAPER1', description: 'General Studies Paper 1', order: 1 },
        { name: 'Paper 2', code: 'PAPER2', description: 'CSAT Paper 2', order: 2 },
      ];

      for (const tierData of upscTiers) {
        let tier = await Tier.findOne({ code: tierData.code, category: upscPrelimsCategory._id });
        if (!tier) {
          tier = new Tier({
            ...tierData,
            category: createdCategories['UPSC']._id,
            subCategory: upscPrelimsCategory._id
          });
          await tier.save();
          console.log(`Created tier: ${tier.name} for UPSC Prelims`);
        }
      }
    }

    console.log('\n✅ Category seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
};

seedCategories();


