import mongoose from 'mongoose';
import ExamAttempt from '../models/ExamAttempt.js';

/** Derive a single difficulty label from exam difficultyDistribution (%). */
export function deriveDifficultyLabel(difficultyDistribution) {
  if (!difficultyDistribution) return null;
  const easy = Number(difficultyDistribution.easy) || 0;
  const medium = Number(difficultyDistribution.medium) || 0;
  const hard = Number(difficultyDistribution.hard) || 0;
  const total = easy + medium + hard;
  if (total <= 0) return null;

  const max = Math.max(easy, medium, hard);
  if (hard === max && hard >= 35) return 'Hard';
  if (medium === max && medium >= 35) return 'Medium';
  if (easy === max && easy >= 35) return 'Easy';
  if (hard >= 25 && medium >= 25 && easy >= 25) return 'Mixed';
  if (hard === max) return 'Hard';
  if (medium === max) return 'Medium';
  return 'Easy';
}

/** Live attempt aggregates for exam list / detail cards. */
export async function getAttemptStatsByExamIds(examIds) {
  if (!examIds?.length) return {};

  const objectIds = examIds.map((id) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );

  const rows = await ExamAttempt.aggregate([
    { $match: { exam: { $in: objectIds }, isCompleted: true } },
    {
      $group: {
        _id: '$exam',
        totalAttempts: { $sum: 1 },
        uniqueParticipants: { $addToSet: '$user' },
        topScore: { $max: '$totalScore' },
        averageScore: { $avg: '$totalScore' },
      },
    },
  ]);

  const map = {};
  for (const row of rows) {
    map[row._id.toString()] = {
      totalAttempts: row.totalAttempts,
      uniqueParticipants: row.uniqueParticipants?.length || 0,
      topScore: row.topScore ?? null,
      averageScore:
        row.averageScore != null ? Math.round(row.averageScore * 10) / 10 : null,
    };
  }
  return map;
}

export function enrichExamWithStats(examObj, attemptStatsMap) {
  const id = examObj._id?.toString?.() || String(examObj._id);
  const live = attemptStatsMap[id];
  const stored = examObj.statistics || {};

  const totalAttempts = live?.totalAttempts ?? stored.totalAttempts ?? 0;
  const uniqueParticipants = live?.uniqueParticipants ?? stored.uniqueParticipants ?? 0;
  const topScore = live?.topScore ?? stored.highestScore ?? null;
  const averageScore = live?.averageScore ?? stored.averageScore ?? null;

  return {
    ...examObj,
    difficultyLevel: deriveDifficultyLabel(examObj.difficultyDistribution),
    attemptStats:
      totalAttempts > 0 || uniqueParticipants > 0 || topScore != null
        ? {
            totalAttempts,
            uniqueParticipants,
            topScore,
            averageScore,
          }
        : null,
  };
}
