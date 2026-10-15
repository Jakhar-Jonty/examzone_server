import Question from '../models/Question.js';
import { visibleStatus } from '../utils/questionVisibility.js';
import { getFocus, focusFilter } from '../utils/focus.js';
import Exam from '../models/Exam.js';
import User from '../models/User.js';

const PYQ_STATUS = visibleStatus();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Prefer shift, else paperSet, else empty string (untagged year paper). */
export const paperShiftKey = (shift, paperSet) => {
  const s = (shift || '').trim();
  if (s) return s;
  return (paperSet || '').trim();
};

/** Apply shift / paperSet / untagged filter onto a Mongo match object. */
export const applyPyqPaperShiftFilter = (match, shift, paperSet) => {
  const s = (shift || '').trim();
  const p = (paperSet || '').trim();
  if (s) {
    match.shift = { $regex: new RegExp(`^${escapeRegex(s)}$`, 'i') };
    return;
  }
  if (p) {
    match.paperSet = { $regex: new RegExp(`^${escapeRegex(p)}$`, 'i') };
    return;
  }
  const emptyOrMissing = (field) => ({
    $or: [{ [field]: null }, { [field]: '' }, { [field]: { $exists: false } }],
  });
  match.$and = [...(match.$and || []), emptyOrMissing('shift'), emptyOrMissing('paperSet')];
};

const paperLabel = (sourceExam, year, shiftKey) => {
  const base = `${sourceExam} ${year}`;
  return shiftKey ? `${base} · ${shiftKey}` : base;
};

export const getPyqMeta = async (req, res) => {
  try {
    const focus = await getFocus();
    const rows = await Question.aggregate([
      { $match: { isPYQ: true, status: PYQ_STATUS, ...focusFilter(focus) } },
      {
        $group: {
          _id: { sourceExam: '$sourceExam', year: '$sourceYear' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byExam = new Map();
    for (const row of rows) {
      const name = (row._id.sourceExam || 'Unknown').trim() || 'Unknown';
      const year = row._id.year;
      if (!byExam.has(name)) byExam.set(name, { sourceExam: name, totalQuestions: 0, years: [] });
      const entry = byExam.get(name);
      entry.totalQuestions += row.count;
      if (year != null) entry.years.push({ year, count: row.count });
    }

    const exams = [...byExam.values()]
      .map((e) => ({
        ...e,
        years: e.years.sort((a, b) => b.year - a.year),
      }))
      .sort((a, b) => a.sourceExam.localeCompare(b.sourceExam));

    res.json({ exams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPyqPapers = async (req, res) => {
  try {
    const sourceExam = (req.query.sourceExam || '').trim();
    if (!sourceExam) {
      return res.status(400).json({ message: 'sourceExam is required' });
    }

    const examRegex = new RegExp(`^${escapeRegex(sourceExam)}$`, 'i');
    const focus = await getFocus();
    const rows = await Question.aggregate([
      {
        $match: {
          isPYQ: true,
          status: PYQ_STATUS,
          sourceExam: { $regex: examRegex },
          sourceYear: { $ne: null },
          ...focusFilter(focus),
        },
      },
      {
        $group: {
          _id: {
            year: '$sourceYear',
            shift: { $trim: { input: { $ifNull: ['$shift', ''] } } },
            paperSet: { $trim: { input: { $ifNull: ['$paperSet', ''] } } },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const merged = new Map();
    for (const row of rows) {
      const year = row._id.year;
      if (year == null) continue;
      const key = paperShiftKey(row._id.shift, row._id.paperSet);
      const mapKey = `${year}::${key.toLowerCase()}`;
      const existing = merged.get(mapKey);
      if (existing) {
        existing.questionCount += row.count;
      } else {
        const shiftVal = (row._id.shift || '').trim() || null;
        const setVal = !shiftVal ? (row._id.paperSet || '').trim() || null : null;
        merged.set(mapKey, {
          year,
          shift: shiftVal,
          paperSet: setVal,
          questionCount: row.count,
          label: paperLabel(sourceExam, year, key),
          curatedExamId: null,
        });
      }
    }

    const papers = [...merged.values()].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return a.label.localeCompare(b.label);
    });

    const user = await User.findById(req.user._id);
    const { getCategoryIdsFromExamPreparations } = await import('../utils/examPrepHelper.js');
    const categoryIds = await getCategoryIdsFromExamPreparations(user.examPreparations);
    const now = new Date();

    const curatedQuery = {
      examType: 'pyq',
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: { $lte: now },
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
      $and: [
        {
          $or: [
            { expiresAt: { $gte: now } },
            { expiresAt: null },
            { expiresAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { title: { $regex: examRegex } },
            { title: { $regex: new RegExp(escapeRegex(sourceExam), 'i') } },
          ],
        },
      ],
    };
    if (categoryIds.length) curatedQuery.category = { $in: categoryIds };

    const curatedExams = await Exam.find(curatedQuery).select('_id title').lean();

    for (const paper of papers) {
      const yearStr = String(paper.year);
      let candidates = curatedExams.filter((e) => (e.title || '').includes(yearStr));
      const shiftKey = paperShiftKey(paper.shift, paper.paperSet);
      if (shiftKey) {
        const withShift = candidates.filter((e) =>
          (e.title || '').toLowerCase().includes(shiftKey.toLowerCase())
        );
        if (withShift.length) candidates = withShift;
      }
      paper.curatedExamId = candidates[0]?._id?.toString() || null;
    }

    res.json({ sourceExam, papers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPyqQuestions = async (req, res) => {
  try {
    const sourceExam = (req.query.sourceExam || '').trim();
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const subject = (req.query.subject || '').trim();
    const shift = (req.query.shift || '').trim();
    const paperSet = (req.query.paperSet || '').trim();

    if (!sourceExam || !year) {
      return res.status(400).json({ message: 'sourceExam and year are required' });
    }

    const match = {
      isPYQ: true,
      status: PYQ_STATUS,
      sourceExam: { $regex: new RegExp(`^${escapeRegex(sourceExam)}$`, 'i') },
      sourceYear: year,
      ...focusFilter(await getFocus()),
    };
    applyPyqPaperShiftFilter(match, shift, paperSet);
    if (subject) {
      match.subject = { $regex: new RegExp(`^${escapeRegex(subject)}$`, 'i') };
    }

    const total = await Question.countDocuments(match);
    const questions = await Question.find(match)
      .select(
        'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi subject topic difficulty language'
      )
      .sort({ subject: 1, topic: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      sourceExam,
      year,
      shift: shift || null,
      paperSet: paperSet || null,
      questions,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalQuestions: total,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
