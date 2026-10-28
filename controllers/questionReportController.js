import mongoose from 'mongoose';
import Question from '../models/Question.js';
import { applyQuestionEdits, toReviewItem } from './questionReviewController.js';

// Reasons a student can pick (subset of Question.flags.type)
export const REPORT_TYPES = ['WrongAnswer', 'Incorrect', 'TypoError', 'Unclear', 'Duplicate', 'Outdated'];
// This many different students reporting the same question hides it from new
// practice/mocks until an admin reviews it (tests already created keep it).
const AUTO_HIDE_AT = 3;
const OPEN = { 'flags.resolved': false };

const sendError = (res, err) => res.status(err.status || 500).json({ message: err.message });
const openFlags = (q) => (q.flags || []).filter((f) => !f.resolved);

// POST /api/questions/:id/report { type, comment? } — any signed-in student
export const reportQuestion = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Question not found.' });
    const type = req.body?.type;
    if (!REPORT_TYPES.includes(type)) return res.status(400).json({ message: 'Pick what is wrong with the question.' });
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';

    const q = await Question.findById(req.params.id).select('flags status');
    if (!q) return res.status(404).json({ message: 'Question not found.' });

    const mine = openFlags(q).some((f) => String(f.reportedBy) === String(req.user._id));
    if (mine) return res.json({ message: 'You have already reported this question. Thanks!' });

    q.flags.push({ type, comment, reportedBy: req.user._id, reportedAt: new Date(), resolved: false });
    const reporters = new Set(openFlags(q).map((f) => String(f.reportedBy)));
    if (reporters.size >= AUTO_HIDE_AT && !['Archived', 'UnderReview', 'Flagged'].includes(q.status)) {
      q.status = 'Flagged';
    }
    await q.save({ validateModifiedOnly: true });
    res.status(201).json({ message: 'Thanks! We will check this question.' });
  } catch (err) {
    sendError(res, err);
  }
};

// GET /api/question-review/reports?page= — admin: questions with open reports, most-reported first
export const listReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [rows, total] = await Promise.all([
      Question.aggregate([
        { $match: OPEN },
        { $addFields: { openCount: { $size: { $filter: { input: '$flags', cond: { $eq: ['$$this.resolved', false] } } } } } },
        { $sort: { openCount: -1, updatedAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            subject: 1, topic: 1, difficulty: 1, status: 1, questionText: 1, questionTextHindi: 1, options: 1,
            optionsHindi: 1, correctAnswer: 1, explanation: 1, explanationHindi: 1, createdAt: 1, flags: 1,
          },
        },
      ]),
      Question.countDocuments(OPEN),
    ]);
    res.json({
      items: rows.map((q) => ({
        ...toReviewItem(q),
        status: q.status || 'Published',
        reports: openFlags(q).map((f) => ({ type: f.type, comment: f.comment || '', reportedAt: f.reportedAt })),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/question-review/reports/:id { action: 'dismiss' | 'fix' | 'archive', edits? } — admin
export const resolveReports = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    const { action, edits } = req.body || {};
    if (!['dismiss', 'fix', 'archive'].includes(action)) {
      return res.status(400).json({ message: 'action must be dismiss, fix or archive' });
    }
    const q = await Question.findById(req.params.id);
    if (!q) return res.status(404).json({ message: 'Not found' });

    if (action === 'fix') {
      if (!edits) return res.status(400).json({ message: 'Send the corrected question.' });
      applyQuestionEdits(q, edits);
    }
    if (action === 'archive') q.status = 'Archived';
    else if (q.status === 'Flagged') q.status = 'Published';

    const now = new Date();
    q.flags.forEach((f) => {
      if (!f.resolved) {
        f.resolved = true;
        f.resolvedBy = req.user._id;
        f.resolvedAt = now;
      }
    });
    // only check what changed: older questions can miss fields the schema now requires
    await q.save({ validateModifiedOnly: true });
    res.json({ id: q._id, status: q.status });
  } catch (err) {
    sendError(res, err);
  }
};
