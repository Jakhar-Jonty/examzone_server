import Category from '../models/Category.js';
import mongoose from 'mongoose';

/**
 * Extract category IDs from examPreparations field
 * Handles backward compatibility for:
 * - Old format: ['SSC', 'Banking', 'HSSC'] (strings)
 * - Transition format: [ObjectId, ObjectId] (direct category IDs)
 * - New format: [{ category: ObjectId, subCategory: ObjectId, ... }] (objects)
 * - Corrupted format: [{ '0': 'H', '1': 'S', ... }] (strings split into chars)
 * 
 * @param {Array} examPreparations - The examPreparations array from user
 * @returns {Promise<Array>} - Array of category ObjectIds
 */
export const getCategoryIdsFromExamPreparations = async (examPreparations) => {
    if (!examPreparations || examPreparations.length === 0) {
        return [];
    }

    const first = examPreparations[0];

    // New format: objects with category field that is a valid ObjectId
    if (first && first.category && mongoose.Types.ObjectId.isValid(first.category)) {
        return examPreparations.map(ep => ep.category);
    }

    // Handle corrupted data where strings were split into character objects
    if (first && typeof first === 'object' && !first.category && first['0']) {
        console.log('⚠️  Detected corrupted examPreparations in read, reconstructing...');
        const reconstructed = examPreparations.map(item => {
            if (typeof item === 'object' && item['0']) {
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

        const categories = await Category.find({
            code: { $in: reconstructed.map(p => p.toUpperCase()) },
            isActive: true
        });
        return categories.map(c => c._id);
    }

    // Old format: strings like "SSC", "Banking", "HSSC"
    if (typeof first === 'string') {
        const categories = await Category.find({
            code: { $in: examPreparations.map(p => p.toUpperCase()) },
            isActive: true
        });
        return categories.map(c => c._id);
    }

    // Transition format: direct ObjectIds
    return examPreparations;
};

/**
 * Normalize examPreparations to new format
 * Converts any format to: [{ category: ObjectId, isPrimary: Boolean }]
 * 
 * @param {Array} examPreparations - The examPreparations array
 * @returns {Promise<Array>} - Array of examPreparation objects
 */
export const normalizeExamPreparations = async (examPreparations) => {
    if (!examPreparations || examPreparations.length === 0) {
        return [];
    }

    // Drop nulls/undefineds before any processing
    const cleaned = examPreparations.filter(Boolean);
    if (cleaned.length === 0) return [];

    const first = cleaned[0];
    examPreparations = cleaned;

    // Already in correct format: has category field that is a real ObjectId (not a string code)
    if (first && first.category && mongoose.Types.ObjectId.isValid(first.category) && typeof first.category !== 'string') {
        return examPreparations;
    }

    // Handle corrupted data where strings were split into character objects
    // Example: { '0': 'H', '1': 'S', '2': 'S', '3': 'C' }
    if (first && typeof first === 'object' && !first.category && first['0']) {
        console.log('⚠️  Detected corrupted examPreparations data, attempting to reconstruct...');
        const reconstructed = examPreparations.map(item => {
            if (typeof item === 'object' && item['0']) {
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

        const categories = await Category.find({
            code: { $in: reconstructed.map(p => p.toUpperCase()) },
            isActive: true
        });

        return categories.map((cat, index) => ({
            category: cat._id,
            isPrimary: index === 0
        }));
    }

    // Object format where category is a string code (e.g. Mongoose partial coercion)
    // Example: [{ category: 'HSSC', isPrimary: false }, ...]
    if (first && typeof first === 'object' && first.category && typeof first.category === 'string') {
        const codes = examPreparations.map(ep => ep.category.toUpperCase());
        const categories = await Category.find({
            code: { $in: codes },
            isActive: true
        });
        return categories.map((cat, index) => ({
            category: cat._id,
            isPrimary: index === 0
        }));
    }

    // Plain string format: ['SSC', 'Banking', 'HSSC']
    if (typeof first === 'string') {
        const categories = await Category.find({
            code: { $in: examPreparations.map(p => p.toUpperCase()) },
            isActive: true
        });

        return categories.map((cat, index) => ({
            category: cat._id,
            isPrimary: index === 0
        }));
    }

    // Transition format: direct ObjectIds — wrap them
    return examPreparations.map((catId, index) => ({
        category: catId,
        isPrimary: index === 0
    }));
};
