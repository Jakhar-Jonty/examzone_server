import mongoose from 'mongoose';
import Question from '../models/Question.js';
import Category from '../models/Category.js';
import { draftHaryanaGkQuestions } from '../utils/aiHaryanaGk.js';
import { HARYANA_GK_SUBJECT, HARYANA_GK_TOPICS } from '../utils/haryanaGk.js';

// Review queue: AI-drafted questions wait as "UnderReview" until an admin
// approves (→ Published, humanVerified) or rejects (→ Archived) them.
const QUEUE = { status: 'UnderReview' };
const LABELS = ['A', 'B', 'C', 'D'];
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const sendError = (res, err) => res.status(err.status || 500).json({ message: err.message });

const toReviewItem = (q) => {
  const options = (q.options || []).map((o) => o.optionText || '');
  const optionsHindi = (q.optionsHindi || []).map((o) => o.optionText || '');
  return {
    _id: q._id,
    subject: q.subject,
    topic: q.topic || '',
    difficulty: q.difficulty,
    questionText: q.questionText || '',
    questionTextHindi: q.questionTextHindi || '',
    options,
    optionsHindi,
    correctIndex: Math.max(0, LABELS.indexOf(q.correctAnswer)),
    explanation: q.explanation || '',
    explanationHindi: q.explanationHindi || '',
    createdAt: q.createdAt,
  };
};

// GET /api/question-review?subject=&topic=&page=
export const listQueue = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { ...QUEUE };
    if (str(req.query.subject)) filter.subject = str(req.query.subject);
    if (str(req.query.topic)) filter.topic = str(req.query.topic);

    const [items, total, groups] = await Promise.all([
      Question.find(filter)
        .select('subject topic difficulty questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi createdAt')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Question.countDocuments(filter),
      Question.aggregate([
        { $match: QUEUE },
        { $group: { _id: { subject: '$subject', topic: '$topic' }, n: { $sum: 1 } } },
        { $sort: { '_id.subject': 1, '_id.topic': 1 } },
      ]),
    ]);
    res.json({
      items: items.map(toReviewItem),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      groups: groups.map((g) => ({ subject: g._id.subject, topic: g._id.topic || '', count: g.n })),
    });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/question-review/:id { action: 'approve' | 'reject', edits? }
export const reviewQuestion = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    const { action, edits } = req.body || {};
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'action must be approve or reject' });

    const q = await Question.findOne({ _id: req.params.id, ...QUEUE });
    if (!q) return res.status(404).json({ message: 'Already reviewed or not found' });

    if (action === 'reject') {
      q.status = 'Archived';
      q.tags = [...new Set([...(q.tags || []), 'rejected'])];
      await q.save();
      return res.json({ id: q._id, status: q.status });
    }

    if (edits) {
      const options = (Array.isArray(edits.options) ? edits.options : []).map(str);
      const optionsHindi = (Array.isArray(edits.optionsHindi) ? edits.optionsHindi : []).map(str);
      const idx = Number(edits.correctIndex);
      if (options.length !== 4 || !options.every(Boolean)) {
        return res.status(400).json({ message: 'All 4 English options are required.' });
      }
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) return res.status(400).json({ message: 'Pick the correct option.' });
      if (!str(edits.questionText) && !str(edits.questionTextHindi)) {
        return res.status(400).json({ message: 'Question text is required.' });
      }
      q.questionText = str(edits.questionText) || str(edits.questionTextHindi);
      q.questionTextHindi = str(edits.questionTextHindi);
      q.options = options.map((text, i) => ({ optionText: text, optionLabel: LABELS[i], isCorrect: i === idx }));
      q.optionsHindi = optionsHindi.length === 4 && optionsHindi.some(Boolean)
        ? optionsHindi.map((text, i) => ({ optionText: text, optionLabel: LABELS[i] }))
        : [];
      q.correctAnswer = LABELS[idx];
      q.explanation = str(edits.explanation);
      q.explanationHindi = str(edits.explanationHindi);
      if (['Easy', 'Medium', 'Hard'].includes(edits.difficulty)) q.difficulty = edits.difficulty;
      if (str(edits.topic)) q.topic = str(edits.topic);
    }

    q.status = 'Published';
    q.humanVerified = true;
    q.verifiedBy = req.user._id;
    q.tags = (q.tags || []).filter((t) => t !== 'ai-draft');
    await q.save();
    res.json({ id: q._id, status: q.status });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/question-review/generate/haryana-gk { topic: key, count }
export const generateHaryanaGk = async (req, res) => {
  try {
    const topic = HARYANA_GK_TOPICS.find((t) => t.key === req.body?.topic);
    if (!topic || topic.key === 'current-affairs') {
      return res.status(400).json({ message: 'Pick a Haryana GK topic (current affairs come from the Current Affairs page).' });
    }
    const count = Math.min(20, Math.max(5, parseInt(req.body.count, 10) || 15));
    const created = await createHaryanaGkDrafts({ topic, count, userId: req.user._id });
    res.status(201).json({ created: created.length, topic: topic.label });
  } catch (err) {
    sendError(res, err);
  }
};

/** Generate drafts for one topic and save them to the review queue. Shared with the batch script. */
export const createHaryanaGkDrafts = async ({ topic, count, userId }) => {
  const category = await Category.findOne({ name: /^hssc$/i, parentCategory: null }).select('_id').lean();
  if (!category) throw new Error('HSSC category not found.');

  // everything already in the bank for this topic (including queued drafts), so the AI avoids repeats
  const existing = await Question.find({ subject: HARYANA_GK_SUBJECT, topic: topic.label, status: { $ne: 'Archived' } })
    .select('questionText')
    .lean();

  const drafts = await draftHaryanaGkQuestions({
    topicKey: topic.key,
    count,
    existing: existing.map((q) => q.questionText),
  });
  if (!drafts.length) return [];

  return Question.insertMany(
    drafts.map((d) => ({
      questionText: d.questionText,
      questionTextHindi: d.questionTextHindi,
      questionType: 'MCQ',
      options: d.options.map((text, i) => ({ optionText: text, optionLabel: LABELS[i], isCorrect: i === d.correctIndex })),
      optionsHindi: d.optionsHindi.length === 4 ? d.optionsHindi.map((text, i) => ({ optionText: text, optionLabel: LABELS[i] })) : [],
      correctAnswer: LABELS[d.correctIndex],
      explanation: d.explanation,
      explanationHindi: d.explanationHindi,
      category: category._id,
      subject: HARYANA_GK_SUBJECT,
      topic: topic.label,
      difficulty: d.difficulty,
      language: d.questionTextHindi ? 'Both' : 'English',
      isAIGenerated: true,
      humanVerified: false,
      status: 'UnderReview',
      tags: ['ai-draft', 'haryana-gk'],
      createdBy: userId,
    }))
  );
};
