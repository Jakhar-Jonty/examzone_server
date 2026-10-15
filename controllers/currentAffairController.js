import mongoose from 'mongoose';
import CurrentAffair from '../models/CurrentAffair.js';
import Question from '../models/Question.js';
import Category from '../models/Category.js';
import PracticeSession from '../models/PracticeSession.js';
import { draftCurrentAffair, cleanQuestions } from '../utils/aiCurrentAffairs.js';
import { istDateKey } from '../utils/istDay.js';
import { HARYANA_GK_SUBJECT } from '../utils/haryanaGk.js';

const TOPIC = 'Current Affairs';
const LABELS = ['A', 'B', 'C', 'D'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_SOURCE = 80;
const MAX_SOURCE = 20000;

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const subjectFor = (region) => (region === 'National' ? 'General Knowledge' : HARYANA_GK_SUBJECT);
const linkedIds = (ca) => (ca.questions || []).map((q) => q.question).filter(Boolean).map(String);

// Lenient: keeps half-finished MCQs so an admin never loses edits. Publish validates strictly.
const normalizeMcq = (q) => {
  const pad = (arr) => [0, 1, 2, 3].map((i) => str(Array.isArray(arr) ? arr[i] : ''));
  const idx = Number(q?.correctIndex);
  return {
    ...(q?._id && mongoose.isValidObjectId(q._id) ? { _id: q._id } : {}),
    questionText: str(q?.questionText),
    questionTextHindi: str(q?.questionTextHindi),
    options: pad(q?.options),
    optionsHindi: pad(q?.optionsHindi),
    correctIndex: Number.isInteger(idx) && idx >= 0 && idx < 4 ? idx : 0,
    explanation: str(q?.explanation),
    explanationHindi: str(q?.explanationHindi),
    difficulty: ['Easy', 'Medium', 'Hard'].includes(q?.difficulty) ? q.difficulty : 'Medium',
    ...(q?.question && mongoose.isValidObjectId(q.question) ? { question: q.question } : {}),
  };
};

const editableFields = (body) => {
  const out = {};
  if (body.date !== undefined) {
    if (!DATE_RE.test(String(body.date))) throw Object.assign(new Error('date must be YYYY-MM-DD'), { status: 400 });
    out.date = body.date;
  }
  if (body.region !== undefined) out.region = body.region === 'National' ? 'National' : 'Haryana';
  for (const f of ['title', 'titleHindi', 'summary', 'summaryHindi', 'sourceUrl']) {
    if (body[f] !== undefined) out[f] = str(body[f]);
  }
  if (Array.isArray(body.keyPoints)) {
    out.keyPoints = body.keyPoints
      .map((k) => ({ text: str(k?.text), textHindi: str(k?.textHindi) }))
      .filter((k) => k.text || k.textHindi);
  }
  if (Array.isArray(body.tags)) out.tags = body.tags.map(str).filter(Boolean).slice(0, 8);
  if (Array.isArray(body.questions)) out.questions = body.questions.map(normalizeMcq);
  return out;
};

const publishProblems = (ca) => {
  const problems = [];
  if (!ca.title && !ca.titleHindi) problems.push('Add a title.');
  if (!ca.summary && !ca.summaryHindi) problems.push('Add a summary.');
  if (!ca.questions.length) problems.push('Add at least one question.');
  const valid = cleanQuestions(ca.questions.map((q) => q.toObject?.() ?? q));
  if (valid.length !== ca.questions.length) {
    problems.push('Every question needs question text and all 4 options filled in.');
  }
  return problems;
};

const hsscCategoryId = async () => {
  const cat = await Category.findOne({ name: /^hssc$/i, parentCategory: null }).select('_id').lean();
  if (!cat) throw new Error('HSSC category not found — create it before publishing current affairs.');
  return cat._id;
};

const questionDoc = (ca, mcq, categoryId, userId) => ({
  questionText: mcq.questionText || mcq.questionTextHindi,
  questionTextHindi: mcq.questionTextHindi,
  questionType: 'MCQ',
  options: mcq.options.map((text, i) => ({ optionText: text, optionLabel: LABELS[i], isCorrect: i === mcq.correctIndex })),
  optionsHindi: mcq.optionsHindi.some(Boolean)
    ? mcq.optionsHindi.map((text, i) => ({ optionText: text, optionLabel: LABELS[i] }))
    : [],
  correctAnswer: LABELS[mcq.correctIndex],
  explanation: mcq.explanation,
  explanationHindi: mcq.explanationHindi,
  category: categoryId,
  subject: subjectFor(ca.region),
  topic: TOPIC,
  difficulty: mcq.difficulty,
  language: mcq.questionTextHindi ? 'Both' : 'English',
  tags: ['current-affairs', ca.date, ...(ca.tags || [])],
  isAIGenerated: !!ca.aiGenerated,
  humanVerified: true,
  verifiedBy: userId,
  status: 'Published',
  createdBy: userId,
});

/** Copy the item's MCQs into the question bank; archive ones that were removed. */
const syncQuestions = async (ca, previousIds, userId) => {
  const categoryId = await hsscCategoryId();
  for (const mcq of ca.questions) {
    const doc = questionDoc(ca, mcq, categoryId, userId);
    const updated = mcq.question
      ? await Question.findByIdAndUpdate(mcq.question, { $set: doc }, { new: true }).select('_id')
      : null;
    if (!updated) mcq.question = (await Question.create(doc))._id;
  }
  const keep = new Set(linkedIds(ca));
  const removed = previousIds.filter((id) => !keep.has(id));
  if (removed.length) await Question.updateMany({ _id: { $in: removed } }, { $set: { status: 'Archived' } });
};

const archiveLinked = (ca) =>
  Question.updateMany({ _id: { $in: linkedIds(ca) } }, { $set: { status: 'Archived' } });

const sendError = (res, err) => res.status(err.status || 500).json({ message: err.message });

// ─── Admin ────────────────────────────────────────────────

// GET /api/current-affairs/admin?status=draft|published&page=1
export const adminList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = ['draft', 'published'].includes(req.query.status) ? { status: req.query.status } : {};
    const [items, total, drafts] = await Promise.all([
      CurrentAffair.find(filter)
        .select('-sourceText -keyPoints')
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CurrentAffair.countDocuments(filter),
      CurrentAffair.countDocuments({ status: 'draft' }),
    ]);
    res.json({
      items: items.map(({ questions, ...rest }) => ({ ...rest, questionCount: questions?.length || 0 })),
      total,
      drafts,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    sendError(res, err);
  }
};

// GET /api/current-affairs/admin/:id
export const adminGet = async (req, res) => {
  try {
    const ca = await CurrentAffair.findById(req.params.id).lean();
    if (!ca) return res.status(404).json({ message: 'Not found' });
    res.json({ item: ca });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/current-affairs/admin/draft — pasted news → AI draft (saved as draft, never published)
export const adminDraft = async (req, res) => {
  try {
    const sourceText = str(req.body.sourceText);
    if (sourceText.length < MIN_SOURCE) {
      return res.status(400).json({ message: `Paste the full news text (at least ${MIN_SOURCE} characters).` });
    }
    if (sourceText.length > MAX_SOURCE) {
      return res.status(400).json({ message: `News text is too long (max ${MAX_SOURCE} characters). Paste one story at a time.` });
    }
    const region = req.body.region === 'National' ? 'National' : 'Haryana';
    const questionCount = Math.min(6, Math.max(2, parseInt(req.body.questionCount, 10) || 4));
    const date = DATE_RE.test(String(req.body.date)) ? req.body.date : istDateKey();

    const draft = await draftCurrentAffair({ sourceText, region, questionCount });
    const ca = await CurrentAffair.create({
      ...draft,
      date,
      region,
      sourceText,
      sourceUrl: str(req.body.sourceUrl),
      aiGenerated: true,
      createdBy: req.user._id,
    });
    res.status(201).json({ item: ca });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/current-affairs/admin — blank/manual item
export const adminCreate = async (req, res) => {
  try {
    const ca = await CurrentAffair.create({
      date: istDateKey(),
      ...editableFields(req.body),
      sourceText: str(req.body.sourceText),
      createdBy: req.user._id,
    });
    res.status(201).json({ item: ca });
  } catch (err) {
    sendError(res, err);
  }
};

// PUT /api/current-affairs/admin/:id — edits; a published item re-syncs its questions
export const adminUpdate = async (req, res) => {
  try {
    const ca = await CurrentAffair.findById(req.params.id);
    if (!ca) return res.status(404).json({ message: 'Not found' });
    const previousIds = linkedIds(ca);
    ca.set(editableFields(req.body));

    if (ca.status === 'published') {
      const problems = publishProblems(ca);
      if (problems.length) return res.status(400).json({ message: problems.join(' '), problems });
      await syncQuestions(ca, previousIds, req.user._id);
      ca.reviewedBy = req.user._id;
    }
    await ca.save();
    res.json({ item: ca });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/current-affairs/admin/:id/publish
export const adminPublish = async (req, res) => {
  try {
    const ca = await CurrentAffair.findById(req.params.id);
    if (!ca) return res.status(404).json({ message: 'Not found' });
    const problems = publishProblems(ca);
    if (problems.length) return res.status(400).json({ message: problems.join(' '), problems });

    await syncQuestions(ca, linkedIds(ca), req.user._id);
    ca.status = 'published';
    ca.publishedAt = ca.publishedAt || new Date();
    ca.reviewedBy = req.user._id;
    await ca.save();
    res.json({ item: ca });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/current-affairs/admin/:id/unpublish — hides it and archives its questions
export const adminUnpublish = async (req, res) => {
  try {
    const ca = await CurrentAffair.findById(req.params.id);
    if (!ca) return res.status(404).json({ message: 'Not found' });
    await archiveLinked(ca);
    ca.status = 'draft';
    await ca.save();
    res.json({ item: ca });
  } catch (err) {
    sendError(res, err);
  }
};

// DELETE /api/current-affairs/admin/:id — questions are archived, not deleted (attempts reference them)
export const adminDelete = async (req, res) => {
  try {
    const ca = await CurrentAffair.findById(req.params.id);
    if (!ca) return res.status(404).json({ message: 'Not found' });
    await archiveLinked(ca);
    await ca.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    sendError(res, err);
  }
};

// ─── Students ─────────────────────────────────────────────

const PUBLIC_FIELDS = 'date region title titleHindi summary summaryHindi keyPoints tags sourceUrl publishedAt questions';
const toPublic = ({ questions, ...rest }) => ({ ...rest, questionCount: questions?.length || 0 });

// GET /api/current-affairs?limit=20&before=YYYY-MM-DD&region=Haryana
export const list = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { status: 'published' };
    if (DATE_RE.test(String(req.query.before))) filter.date = { $lt: req.query.before };
    if (['Haryana', 'National'].includes(req.query.region)) filter.region = req.query.region;

    const items = await CurrentAffair.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ date: -1, publishedAt: -1 })
      .limit(limit)
      .lean();
    // Never split a day across pages: the next page asks for dates before the last one
    const hasMore = items.length === limit;
    if (hasMore) {
      const lastDate = items[items.length - 1].date;
      const seen = new Set(items.map((i) => String(i._id)));
      const rest = await CurrentAffair.find({ ...filter, date: lastDate, _id: { $nin: [...seen] } })
        .select(PUBLIC_FIELDS)
        .sort({ publishedAt: -1 })
        .lean();
      items.push(...rest);
    }
    res.json({ items: items.map(toPublic), today: istDateKey(), hasMore });
  } catch (err) {
    sendError(res, err);
  }
};

// GET /api/current-affairs/:id
export const getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    const ca = await CurrentAffair.findOne({ _id: req.params.id, status: 'published' }).select(PUBLIC_FIELDS).lean();
    if (!ca) return res.status(404).json({ message: 'Not found' });
    res.json({ item: toPublic(ca) });
  } catch (err) {
    sendError(res, err);
  }
};

// POST /api/current-affairs/quiz { id } or { date } — practice the item's (or the whole day's) MCQs
export const startQuiz = async (req, res) => {
  try {
    const { id, date } = req.body || {};
    let filter;
    if (id && mongoose.isValidObjectId(id)) filter = { _id: id, status: 'published' };
    else if (DATE_RE.test(String(date))) filter = { date, status: 'published' };
    else return res.status(400).json({ message: 'Pass an id or a date (YYYY-MM-DD).' });

    const items = await CurrentAffair.find(filter).select('questions.question region').lean();
    const ids = items.flatMap((ca) => linkedIds(ca));
    const usable = await Question.find({ _id: { $in: ids }, status: 'Published' }).select('_id').lean();
    if (!usable.length) return res.status(404).json({ message: 'No questions for this current affairs yet.' });

    const session = await PracticeSession.create({
      user: req.user._id,
      sessionType: 'custom',
      filters: { subject: subjectFor(items[0]?.region), topics: [TOPIC] },
      questions: usable.map((q) => q._id),
      totalQuestions: usable.length,
      startTime: new Date(),
    });
    res.status(201).json({ session });
  } catch (err) {
    sendError(res, err);
  }
};
