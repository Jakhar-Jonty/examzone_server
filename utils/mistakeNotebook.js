import SavedQuestion from '../models/SavedQuestion.js';

/**
 * Auto-save wrong answers from a completed attempt into the mistake notebook.
 * Uses bulkWrite for efficiency — one DB round-trip instead of 2N.
 */
export async function syncMistakeNotebook(userId, attempt) {
  const now = new Date();
  const examId = attempt.exam?._id || attempt.exam;

  const wrongAnswers = (attempt.answers || []).filter(
    (a) => a.isCorrect === false && a.selectedAnswer
  );

  if (wrongAnswers.length === 0) return { added: 0, updated: 0, total: 0 };

  const questionIds = wrongAnswers.map((a) => a.question?._id || a.question).filter(Boolean);

  const existing = await SavedQuestion.find({
    user: userId,
    question: { $in: questionIds },
  })
    .select('question source tags status')
    .lean();

  const existingMap = new Map(
    existing.map((sq) => [(sq.question?._id || sq.question).toString(), sq])
  );

  const ops = [];

  for (const answer of wrongAnswers) {
    const question = answer.question;
    const questionId = question?._id || question;
    if (!questionId) continue;

    const key = questionId.toString();
    const prev = existingMap.get(key);

    if (prev) {
      const update = {
        $inc: { wrongCount: 1 },
        $set: {
          lastWrongAt: now,
          lastWrongAnswer: answer.selectedAnswer,
          lastExamId: examId,
        },
        $addToSet: { tags: 'mistake' },
      };
      if (prev.source !== 'manual') update.$set.source = 'auto';
      if (prev.status !== 'mastered') update.$set.status = 'needs-review';
      if (question?.subject) update.$set.subject = question.subject;
      if (question?.topic) update.$set.topic = question.topic;

      ops.push({
        updateOne: {
          filter: { _id: prev._id },
          update,
        },
      });
    } else {
      ops.push({
        updateOne: {
          filter: { user: userId, question: questionId },
          update: {
            $setOnInsert: {
              user: userId,
              question: questionId,
              source: 'auto',
              tags: ['mistake'],
              status: 'needs-review',
              savedAt: now,
            },
            $set: {
              lastWrongAt: now,
              lastWrongAnswer: answer.selectedAnswer,
              lastExamId: examId,
              subject: question?.subject || '',
              topic: question?.topic || '',
            },
            $inc: { wrongCount: 1 },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length === 0) return { added: 0, updated: 0, total: 0 };

  const result = await SavedQuestion.bulkWrite(ops, { ordered: false });

  const added = result.upsertedCount || 0;
  const updated = (result.modifiedCount || 0);

  return { added, updated, total: added + updated };
}
