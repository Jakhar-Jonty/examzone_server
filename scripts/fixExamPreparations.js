import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Direct database migration to fix corrupted examPreparations
 * This bypasses Mongoose schema validation
 */
async function fixCorruptedData() {
    try {
        console.log('🔄 Connecting to MongoDB...\n');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Find all users with examPreparations
        const users = await usersCollection.find({
            examPreparations: { $exists: true, $ne: [] }
        }).toArray();

        console.log(`📊 Found ${users.length} users with examPreparations\n`);

        let fixedCount = 0;
        let alreadyCorrectCount = 0;
        let errorCount = 0;

        // Get Category model for lookups
        const categoriesCollection = db.collection('categories');

        for (const user of users) {
            try {
                if (!user.examPreparations || user.examPreparations.length === 0) {
                    continue;
                }

                const first = user.examPreparations[0];
                let needsFix = false;
                let newExamPreparations = [];

                // Check if corrupted (has character indices)
                if (first && typeof first === 'object' && first['0'] !== undefined) {
                    console.log(`🔧 Fixing corrupted data for: ${user.name} (${user.phoneNumber})`);
                    needsFix = true;

                    // Reconstruct strings from character objects
                    const reconstructed = user.examPreparations.map(item => {
                        if (typeof item === 'object' && item['0'] !== undefined) {
                            const chars = [];
                            let i = 0;
                            while (item[i.toString()] !== undefined) {
                                chars.push(item[i.toString()]);
                                i++;
                            }
                            return chars.join('');
                        }
                        return item;
                    });

                    console.log(`   Reconstructed: ${JSON.stringify(reconstructed)}`);

                    // Look up categories
                    const categories = await categoriesCollection.find({
                        code: { $in: reconstructed.map(c => c.toUpperCase()) },
                        isActive: true
                    }).toArray();

                    newExamPreparations = categories.map((cat, index) => ({
                        category: cat._id,
                        isPrimary: index === 0
                    }));

                } else if (typeof first === 'string') {
                    console.log(`🔄 Converting string format for: ${user.name} (${user.phoneNumber})`);
                    needsFix = true;

                    // Look up categories
                    const categories = await categoriesCollection.find({
                        code: { $in: user.examPreparations.map(c => c.toUpperCase()) },
                        isActive: true
                    }).toArray();

                    newExamPreparations = categories.map((cat, index) => ({
                        category: cat._id,
                        isPrimary: index === 0
                    }));

                } else if (first && first.category) {
                    console.log(`✓ User ${user.name} already has correct format`);
                    alreadyCorrectCount++;
                    continue;
                } else {
                    console.log(`⚠️  User ${user.name} has unknown format`);
                    alreadyCorrectCount++;
                    continue;
                }

                if (needsFix && newExamPreparations.length > 0) {
                    // Update directly in database
                    await usersCollection.updateOne(
                        { _id: user._id },
                        { $set: { examPreparations: newExamPreparations } }
                    );

                    console.log(`   ✅ Fixed! New format:`, JSON.stringify(newExamPreparations));
                    console.log('');
                    fixedCount++;
                } else if (needsFix) {
                    console.log(`   ⚠️  Could not find matching categories`);
                    errorCount++;
                }

            } catch (error) {
                console.error(`❌ Error fixing user ${user.name}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 Migration Summary:');
        console.log(`   Total users: ${users.length}`);
        console.log(`   Fixed/Converted: ${fixedCount}`);
        console.log(`   Already correct: ${alreadyCorrectCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log('='.repeat(60));

        await mongoose.connection.close();
        console.log('\n✅ Migration complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
fixCorruptedData();
