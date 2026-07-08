import TestSeries from '../models/TestSeries.js';
import TestSeriesEnrollment from '../models/TestSeriesEnrollment.js';
import Exam from '../models/Exam.js';

// =============================================================
// POST /admin/test-series
// =============================================================
export const createTestSeries = async (req, res) => {
    try {
        const {
            title, description, thumbnail, category, subCategory, tier,
            seriesType, exams, isPremium, price, discountPrice,
            validityDays, startDate, endDate, enrollmentType, maxEnrollments,
            tags, keywords, features, status
        } = req.body;

        if (!title || !category) {
            return res.status(400).json({ message: 'Title and category are required.' });
        }

        const totalTests = exams?.length || 0;

        // Count total questions across all exams in the series
        let totalQuestions = 0;
        if (exams && exams.length > 0) {
            const examIds = exams.map(e => e.exam);
            const examDocs = await Exam.find({ _id: { $in: examIds } }).select('questions sections').lean();
            examDocs.forEach(exam => {
                if (exam.sections?.length > 0) {
                    exam.sections.forEach(s => { totalQuestions += s.questions?.length || 0; });
                } else {
                    totalQuestions += exam.questions?.length || 0;
                }
            });
        }

        const testSeries = new TestSeries({
            title, description, thumbnail, category, subCategory, tier,
            seriesType: seriesType || 'mock',
            exams: (exams || []).map((e, i) => ({ ...e, order: e.order ?? i + 1 })),
            isPremium: isPremium || false,
            price: price || 0,
            discountPrice,
            validityDays,
            startDate,
            endDate,
            enrollmentType: enrollmentType || 'free',
            maxEnrollments,
            totalTests,
            totalQuestions,
            tags: tags || [],
            keywords: keywords || [],
            features: features || [],
            status: status || 'draft',
            createdBy: req.admin?._id,
        });

        await testSeries.save();
        res.status(201).json({ message: 'Test series created successfully', testSeries });
    } catch (error) {
        console.error('createTestSeries error:', error);
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/test-series
// =============================================================
export const getTestSeries = async (req, res) => {
    try {
        const { status, category, page = 1, limit = 20, search } = req.query;
        const query = {};

        if (status) query.status = status;
        if (category) query.category = category;
        if (search) query.title = new RegExp(search, 'i');

        const [series, total] = await Promise.all([
            TestSeries.find(query)
                .populate('category', 'name code')
                .populate('subCategory', 'name code')
                .populate('tier', 'name code')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean(),
            TestSeries.countDocuments(query)
        ]);

        res.json({ series, total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/test-series/:id
// =============================================================
export const getTestSeriesById = async (req, res) => {
    try {
        const series = await TestSeries.findById(req.params.id)
            .populate('category', 'name code')
            .populate('subCategory', 'name code')
            .populate('tier', 'name code')
            .populate('exams.exam', 'title duration totalMarks status sections questions')
            .lean();

        if (!series) return res.status(404).json({ message: 'Test series not found.' });
        res.json({ series });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// PUT /admin/test-series/:id
// =============================================================
export const updateTestSeries = async (req, res) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found.' });

        const updateData = { ...req.body };

        // Recalculate totalTests and totalQuestions if exams changed
        if (req.body.exams) {
            updateData.totalTests = req.body.exams.length;
            const examIds = req.body.exams.map(e => e.exam);
            const examDocs = await Exam.find({ _id: { $in: examIds } }).select('questions sections').lean();
            let totalQuestions = 0;
            examDocs.forEach(exam => {
                if (exam.sections?.length > 0) {
                    exam.sections.forEach(s => { totalQuestions += s.questions?.length || 0; });
                } else {
                    totalQuestions += exam.questions?.length || 0;
                }
            });
            updateData.totalQuestions = totalQuestions;
        }

        Object.assign(series, updateData);
        series.updatedAt = new Date();
        await series.save();

        res.json({ message: 'Test series updated successfully', series });
    } catch (error) {
        console.error('updateTestSeries error:', error);
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// POST /admin/test-series/:id/publish
// =============================================================
export const publishTestSeries = async (req, res) => {
    try {
        const series = await TestSeries.findById(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found.' });
        if (series.exams.length === 0) {
            return res.status(400).json({ message: 'Cannot publish a series with no exams.' });
        }
        series.status = 'published';
        series.publishedAt = new Date();
        await series.save();
        res.json({ message: 'Test series published successfully', series });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// POST /admin/test-series/:id/archive
// =============================================================
export const archiveTestSeries = async (req, res) => {
    try {
        const series = await TestSeries.findByIdAndUpdate(
            req.params.id,
            { status: 'archived' },
            { new: true }
        );
        if (!series) return res.status(404).json({ message: 'Test series not found.' });
        res.json({ message: 'Test series archived', series });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// DELETE /admin/test-series/:id
// =============================================================
export const deleteTestSeries = async (req, res) => {
    try {
        const series = await TestSeries.findByIdAndDelete(req.params.id);
        if (!series) return res.status(404).json({ message: 'Test series not found.' });
        res.json({ message: 'Test series deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================================================
// GET /admin/test-series/:id/enrollments
// =============================================================
export const getTestSeriesEnrollments = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const [enrollments, total] = await Promise.all([
            TestSeriesEnrollment.find({ testSeries: req.params.id })
                .populate('user', 'name email phoneNumber')
                .sort({ enrolledAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit))
                .lean(),
            TestSeriesEnrollment.countDocuments({ testSeries: req.params.id })
        ]);
        res.json({ enrollments, total, totalPages: Math.ceil(total / limit), currentPage: Number(page) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
