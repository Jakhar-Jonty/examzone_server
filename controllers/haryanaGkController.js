import Question from '../models/Question.js';
import ExamAttempt from '../models/ExamAttempt.js';
import PracticeSession from '../models/PracticeSession.js';
import { HARYANA_GK_SUBJECT, HARYANA_GK_TOPICS } from '../utils/haryanaGk.js';

const USABLE = { status: { $nin: ['Archived', 'Flagged'] } };

/** Per-question attempts/correct for this user across exams and practice. */
const answerStats = async (userId, questionIds) => {
  const pipeline = (Model) =>
    Model.aggregate([
      { $match: { user: userId, 'answers.question': { $in: questionIds } } },
      { $unwind: '$answers' },
      { $match: { 'answers.question': { $in: questionIds }, 'answers.selectedAnswer': { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$answers.question',
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
        },
      },
    ]);
  const [exam, practice] = await Promise.all([pipeline(ExamAttempt), pipeline(PracticeSession)]);
  const byId = new Map();
  for (const row of [...exam, ...practice]) {
    const key = String(row._id);
    const prev = byId.get(key) || { attempted: 0, correct: 0 };
    byId.set(key, { attempted: prev.attempted + row.attempted, correct: prev.correct + row.correct });
  }
  return byId;
};

// GET /api/haryana-gk/overview — topics with question counts and this user's accuracy.
export const getOverview = async (req, res) => {
  try {
    const questions = await Question.find({ subject: HARYANA_GK_SUBJECT, ...USABLE })
      .select('topic isPYQ')
      .lean();
    const stats = await answerStats(req.user._id, questions.map((q) => q._id));

    const topics = HARYANA_GK_TOPICS.map((t) => ({ ...t, questionCount: 0, attempted: 0, correct: 0 }));
    const byLabel = new Map(topics.map((t) => [t.label.toLowerCase(), t]));
    const overall = { attempted: 0, correct: 0 };
    let pyqCount = 0;

    for (const q of questions) {
      if (q.isPYQ) pyqCount++;
      const s = stats.get(String(q._id));
      if (s) {
        overall.attempted += s.attempted;
        overall.correct += s.correct;
      }
      const topic = byLabel.get((q.topic || '').trim().toLowerCase());
      if (!topic) continue;
      topic.questionCount++;
      if (s) {
        topic.attempted += s.attempted;
        topic.correct += s.correct;
      }
    }

    const withAccuracy = (o) => ({
      ...o,
      accuracy: o.attempted ? Math.round((o.correct / o.attempted) * 100) : null,
    });

    res.json({
      subject: HARYANA_GK_SUBJECT,
      totalQuestions: questions.length,
      pyqCount,
      overall: withAccuracy(overall),
      topics: topics.map(withAccuracy),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
