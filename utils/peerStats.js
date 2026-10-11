import ExamAttempt from '../models/ExamAttempt.js';

const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

function ordinalSuffix(n) {
  const v = Math.round(Math.abs(n));
  if (v % 100 >= 11 && v % 100 <= 13) return `${v}th`;
  const mod = v % 10;
  if (mod === 1) return `${v}st`;
  if (mod === 2) return `${v}nd`;
  if (mod === 3) return `${v}rd`;
  return `${v}th`;
}

export function buildAirCopy(marks) {
  if (!marks?.yourRank || !marks?.totalRanked) return null;
  const percentile = marks.betterThanPercent ?? 0;
  return {
    rank: marks.yourRank,
    total: marks.totalRanked,
    percentile,
    headline: `All India Rank #${marks.yourRank} of ${marks.totalRanked}`,
    subline: `${ordinalSuffix(percentile)} percentile`,
    full: `All India Rank #${marks.yourRank} of ${marks.totalRanked} · ${ordinalSuffix(percentile)} percentile`,
  };
}

/**
 * Aggregate completed attempts for an exam vs the current attempt.
 * No PII — ranks and aggregates only.
 */
export async function buildPeerStats(attempt) {
  const examId = attempt.exam?._id || attempt.exam;
  if (!examId) return null;

  const completed = await ExamAttempt.find({
    exam: examId,
    isCompleted: true,
  })
    .select('totalScore percentage timeTaken')
    .lean();

  if (!completed.length) return null;

  const scores = completed.map((a) => a.totalScore || 0);
  const percentages = completed.map((a) => a.percentage || 0);
  const times = completed
    .map((a) => a.timeTaken)
    .filter((t) => typeof t === 'number' && t > 0);

  const myScore = attempt.totalScore || 0;
  const myPct = attempt.percentage || 0;
  const myTime = attempt.timeTaken || 0;

  const rankByMarks = scores.filter((s) => s > myScore).length + 1;
  // Tie-aware percentile: share of attempts you scored strictly above
  const betterThanMarksPct =
    completed.length > 1
      ? (scores.filter((s) => s < myScore).length / (completed.length - 1)) * 100
      : 100;

  let rankByTime = null;
  let fasterThanPct = null;
  if (myTime > 0 && times.length > 0) {
    rankByTime = times.filter((t) => t < myTime).length + 1;
    fasterThanPct = Number(
      ((times.filter((t) => t > myTime).length / times.length) * 100).toFixed(1)
    );
  }

  const marks = {
    your: myScore,
    avg: Number(avg(scores).toFixed(2)),
    min: Math.min(...scores),
    max: Math.max(...scores),
    yourRank: rankByMarks,
    totalRanked: completed.length,
    betterThanPercent: Number(betterThanMarksPct.toFixed(1)),
  };

  return {
    sampleSize: completed.length,
    sampleSizeWithTime: times.length,
    air: buildAirCopy(marks),
    marks,
    percentage: {
      your: Number(myPct.toFixed(2)),
      avg: Number(avg(percentages).toFixed(2)),
      min: Number(Math.min(...percentages).toFixed(2)),
      max: Number(Math.max(...percentages).toFixed(2)),
    },
    time: {
      your: myTime,
      avg: times.length ? Math.round(avg(times)) : null,
      min: times.length ? Math.min(...times) : null,
      max: times.length ? Math.max(...times) : null,
      yourRank: rankByTime,
      totalRanked: times.length,
      fasterThanPercent: fasterThanPct != null ? Number(fasterThanPct.toFixed(1)) : null,
    },
  };
}
