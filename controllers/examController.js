import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Question from '../models/Question.js';
import User from '../models/User.js';

const EXAM_QUESTION_FIELDS =
  'questionText questionTextHindi options optionsHindi translations correctAnswer explanation explanationHindi marks questionImage language difficulty category subject topic assertion reason';
const EXAM_QUESTION_FIELDS_BASIC =
  'questionText questionTextHindi options optionsHindi translations correctAnswer explanation explanationHindi marks questionImage language';

// Helper to check and reset weekly limit
const checkWeeklyLimit = async (user) => {
  const now = new Date();
  const daysSinceReset = Math.floor((now - user.lastWeekReset) / (1000 * 60 * 60 * 24));

  if (daysSinceReset >= 7) {
    user.weeklyExamsAttempted = 0;
    user.lastWeekReset = now;
    await user.save();
  }

  return user;
};

export const getAvailableExams = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();

    // Use utility helper to get category IDs from examPreparations
    const { getCategoryIdsFromExamPreparations } = await import('../utils/examPrepHelper.js');
    const categoryIds = await getCategoryIdsFromExamPreparations(user.examPreparations);

    // Build query - handle both old and new category formats
    const categoryQuery = categoryIds.length > 0
      ? { category: { $in: categoryIds } }
      : {}; // If no categories found, return empty

    // Get available exams - exams that have started and not expired
    // Account for IST timezone (UTC+5:30) - MongoDB stores in UTC
    const exams = await Exam.find({
      ...categoryQuery,
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: { $lte: now }, // Already started
      $or: [
        { deleted: false },
        { deleted: { $exists: false } }
      ],
      $and: [
        {
          $or: [
            { expiresAt: { $gte: now } }, // Has expiration and not expired yet
            { expiresAt: null }, // No expiration set (available indefinitely)
            { expiresAt: { $exists: false } } // expiresAt field doesn't exist
          ]
        }
      ]
    })
      .select('-questions') // Don't populate questions - only need count
      .sort({ scheduledTime: -1 });

    // Get question counts separately
    const examIds = exams.map(exam => exam._id);
    const examQuestionCounts = await Exam.find({ _id: { $in: examIds } })
      .select('_id questions')
      .lean();

    const questionCountMap = {};
    examQuestionCounts.forEach(exam => {
      questionCountMap[exam._id.toString()] = exam.questions?.length || 0;
    });

    // Check if user has already attempted each exam
    const examsWithAttemptStatus = await Promise.all(
      exams.map(async (exam) => {
        const attempt = await ExamAttempt.findOne({
          user: user._id,
          exam: exam._id,
          isCompleted: true
        });

        return {
          ...exam.toObject(),
          questions: questionCountMap[exam._id.toString()] || 0, // Just the count
          isAttempted: !!attempt,
          attemptId: attempt?._id
        };
      })
    );

    res.json({ exams: examsWithAttemptStatus });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExamDetails = async (req, res) => {
  try {
    // Only populate questions if explicitly requested (for when exam is started)
    const includeQuestions = req.query.includeQuestions === 'true';

    let exam;
    if (includeQuestions) {
      exam = await Exam.findOne({
        _id: req.params.id,
        $or: [
          { deleted: false },
          { deleted: { $exists: false } }
        ]
      })
        .populate({
          path: 'questions',
          select: EXAM_QUESTION_FIELDS
        });
    } else {
      // Don't populate questions - just get exam metadata
      exam = await Exam.findOne({
        _id: req.params.id,
        $or: [
          { deleted: false },
          { deleted: { $exists: false } }
        ]
      })
        .select('-questions'); // Exclude questions array

      if (!exam) {
        return res.status(404).json({ message: 'Exam not found or has been deleted' });
      }

      // Get question count in a single additional query
      const examWithCount = await Exam.findById(req.params.id)
        .select('questions')
        .lean();

      // Convert to object and add question count
      exam = exam.toObject();
      exam.questions = examWithCount?.questions?.length || 0; // Just the count
    }

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Get all completed attempts for this exam
    const completedAttempts = await ExamAttempt.find({
      user: req.user._id,
      exam: req.params.id,
      isCompleted: true
    })
      .select('_id totalScore percentage attemptNumber endTime createdAt')
      .sort({ attemptNumber: -1 })
      .lean();

    // Get latest attempt
    const latestAttempt = completedAttempts.length > 0 ? completedAttempts[0] : null;

    // Calculate best score
    let bestScore = null;
    let bestAttemptId = null;
    if (completedAttempts.length > 0) {
      const bestAttempt = completedAttempts.reduce((best, current) =>
        current.totalScore > best.totalScore ? current : best
      );
      bestScore = bestAttempt.totalScore;
      bestAttemptId = bestAttempt._id;
    }

    // Get paused attempt
    const pausedAttempt = await ExamAttempt.findOne({
      user: req.user._id,
      exam: req.params.id,
      isCompleted: false,
      isPaused: true
    }).select('_id isPaused attemptNumber');

    // Calculate attempt count
    const attemptCount = completedAttempts.length;
    // Default to allowReattempts=true and maxAttempts=3 if not set
    const allowReattempts = exam.allowReattempts !== false; // true if undefined or true
    const maxAttempts = exam.maxAttempts || 3;
    const canReattempt = allowReattempts && attemptCount < maxAttempts;

    res.json({
      exam,
      attemptStatus: {
        isCompleted: attemptCount > 0,
        isPaused: !!pausedAttempt,
        completedAttemptId: latestAttempt?._id,
        pausedAttemptId: pausedAttempt?._id,
        attemptCount,
        canReattempt,
        maxAttempts: maxAttempts,
        attemptsRemaining: maxAttempts - attemptCount,
        bestScore,
        bestAttemptId,
        latestScore: latestAttempt?.totalScore || null,
        latestPercentage: latestAttempt?.percentage || null
      },
      attemptHistory: completedAttempts.map(attempt => ({
        _id: attempt._id,
        attemptNumber: attempt.attemptNumber,
        score: attempt.totalScore,
        percentage: attempt.percentage,
        date: attempt.endTime || attempt.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const startExam = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    // Populate questions only when starting the exam
    const exam = await Exam.findOne({
      _id: req.params.id,
      $or: [
        { deleted: false },
        { deleted: { $exists: false } }
      ]
    })
      .populate({
        path: 'questions',
        select: EXAM_QUESTION_FIELDS
      })
      .select('+sections +timePerQuestion +randomizeQuestions');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or has been deleted' });
    }

    // Check re-attempt logic
    const completedAttempts = await ExamAttempt.find({
      user: user._id,
      exam: exam._id,
      isCompleted: true
    }).select('_id attemptNumber');

    const attemptCount = completedAttempts.length;

    // Check if re-attempts are allowed
    if (attemptCount > 0) {
      if (!exam.allowReattempts) {
        return res.status(400).json({
          message: 'Re-attempts are not allowed for this exam'
        });
      }

      if (attemptCount >= exam.maxAttempts) {
        return res.status(400).json({
          message: `Maximum attempts (${exam.maxAttempts}) reached for this exam`
        });
      }
    }

    // Check subscription and weekly limit
    await checkWeeklyLimit(user);
    const updatedUser = await User.findById(user._id);

    if (updatedUser.subscriptionStatus === 'free') {
      if (updatedUser.weeklyExamsAttempted >= 3) {
        return res.status(403).json({
          message: 'Weekly limit reached. Upgrade to premium for unlimited exams.'
        });
      }
    }

    // Check if exam is available
    const now = new Date();
    if (exam.scheduledTime > now) {
      return res.status(400).json({ message: 'Exam has not started yet' });
    }
    // Only check expiration if expiresAt is set
    if (exam.expiresAt && exam.expiresAt < now) {
      return res.status(400).json({ message: 'Exam has expired' });
    }

    // Create or get existing attempt (including paused)
    let attempt = await ExamAttempt.findOne({
      user: user._id,
      exam: exam._id,
      isCompleted: false
    })
      .populate({
        path: 'answers.question',
        select: EXAM_QUESTION_FIELDS_BASIC
      });

    if (!attempt) {
      // Calculate next attempt number
      const nextAttemptNumber = attemptCount + 1;

      // Randomize questions if enabled
      let questionsToUse = [...exam.questions];
      if (exam.randomizeQuestions) {
        // If exam has sections, randomize within each section separately
        if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
          // Create a map of question IDs to questions for quick lookup
          const questionMap = new Map();
          exam.questions.forEach(q => {
            const qId = q._id ? q._id.toString() : q.toString();
            questionMap.set(qId, q);
          });

          // Randomize questions within each section
          const randomizedQuestions = [];
          exam.sections.forEach(section => {
            if (section.questions && Array.isArray(section.questions)) {
              // Get questions for this section
              const sectionQuestions = section.questions
                .map(sqId => {
                  const sqIdStr = sqId.toString();
                  return questionMap.get(sqIdStr);
                })
                .filter(q => q !== undefined);

              // Shuffle questions within this section
              const shuffledSectionQuestions = sectionQuestions.sort(() => Math.random() - 0.5);
              randomizedQuestions.push(...shuffledSectionQuestions);
            }
          });

          // Add any questions not in any section (shouldn't happen, but just in case)
          const sectionQuestionIds = new Set();
          exam.sections.forEach(section => {
            if (section.questions) {
              section.questions.forEach(sqId => {
                sectionQuestionIds.add(sqId.toString());
              });
            }
          });

          const unassignedQuestions = exam.questions.filter(q => {
            const qId = q._id ? q._id.toString() : q.toString();
            return !sectionQuestionIds.has(qId);
          });

          if (unassignedQuestions.length > 0) {
            // Shuffle unassigned questions and add them at the end
            const shuffledUnassigned = unassignedQuestions.sort(() => Math.random() - 0.5);
            randomizedQuestions.push(...shuffledUnassigned);
          }

          questionsToUse = randomizedQuestions;
        } else {
          // No sections - shuffle all questions together
          questionsToUse = questionsToUse.sort(() => Math.random() - 0.5);
        }
      }

      // Initialize answers array using new schema fields
      const answers = questionsToUse.map(question => ({
        question: question._id || question,
        selectedAnswer: null,
        isCorrect: false,
        marksAwarded: 0,
        marksDeducted: 0,
        netMarks: 0,
        timeSpent: 0,
        isMarkedForReview: false,
        isSkipped: false,
        answerChangedCount: 0,
        viewCount: 1,
        difficulty: question.difficulty || null,
        subject: question.subject || null,
        topic: question.topic || null,
        questionType: question.questionType || null
      }));

      attempt = new ExamAttempt({
        user: user._id,
        exam: exam._id,
        answers,
        startTime: new Date(),
        attemptNumber: nextAttemptNumber,
        attemptType: 'full',
        totalQuestions: questionsToUse.length,
        maxScore: exam.totalMarks || questionsToUse.length // fallback: 1 mark per question
      });
      await attempt.save();

      // Increment weekly count only for new attempts (use updateOne to avoid triggering pre-save hooks)
      await User.updateOne(
        { _id: updatedUser._id },
        { $inc: { weeklyExamsAttempted: 1 } }
      );

      // Populate questions after save
      attempt = await ExamAttempt.findById(attempt._id)
        .populate({
          path: 'answers.question',
          select: EXAM_QUESTION_FIELDS
        });

      // Update question usage statistics
      questionsToUse.forEach(question => {
        Question.findByIdAndUpdate(question._id, {
          $inc: { usageCount: 1 },
          $set: { lastUsed: new Date() }
        }).exec();
      });
    } else if (attempt.isPaused) {
      // Resume paused exam - calculate paused duration
      const now = new Date();
      if (attempt.pausedAt) {
        const pausedTime = Math.floor((now - attempt.pausedAt) / 1000);
        attempt.pausedDuration = (attempt.pausedDuration || 0) + pausedTime;
        attempt.pausedAt = null;
        attempt.isPaused = false;
        attempt.lastResumedAt = now;
        await attempt.save();
      }
    }

    // Return exam with populated questions and sections/timePerQuestion so frontend doesn't need to call getExamDetails again
    const examData = exam.toObject();
    res.json({
      attempt,
      exam: {
        ...examData,
        sections: exam.sections || [],
        timePerQuestion: exam.timePerQuestion || null,
        randomizeQuestions: exam.randomizeQuestions || false
      },
      exam, // Include exam with populated questions
      isResumed: attempt.isPaused === false && attempt.lastResumedAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveAnswers = async (req, res) => {
  try {
    const { answers } = req.body;
    const attempt = await ExamAttempt.findById(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (attempt.isCompleted) {
      return res.status(400).json({ message: 'Exam already submitted' });
    }

    if (attempt.isPaused) {
      return res.status(400).json({ message: 'Exam is paused. Please resume first.' });
    }

    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    attempt.answers = answers;
    await attempt.save();

    res.json({ message: 'Answers saved successfully', attempt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitExam = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.attemptId)
      .populate('exam')
      .populate({
        path: 'answers.question',
        select: EXAM_QUESTION_FIELDS_BASIC
      });

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (attempt.isCompleted) {
      return res.status(400).json({ message: 'Exam already submitted' });
    }

    if (attempt.isPaused) {
      return res.status(400).json({ message: 'Exam is paused. Please resume first.' });
    }

    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // If answers are provided in request body, update them before submitting
    // This ensures answers are saved even if saveAnswers() wasn't called first
    if (req.body.answers && Array.isArray(req.body.answers)) {
      // Ensure all answer fields are properly formatted
      attempt.answers = req.body.answers.map(ans => ({
        question: ans.question,
        selectedAnswer: ans.selectedAnswer || null,
        isCorrect: ans.isCorrect || false,
        marksAwarded: ans.marksAwarded || ans.marksObtained || 0,
        marksDeducted: ans.marksDeducted || 0,
        netMarks: ans.netMarks || ans.marksObtained || 0,
        timeSpent: typeof ans.timeSpent === 'number' ? ans.timeSpent : (parseFloat(ans.timeSpent) || 0),
        isMarkedForReview: ans.isMarkedForReview || false,
        isSkipped: ans.isSkipped || false
      }));
      await attempt.save();
      // Re-populate after saving
      await attempt.populate({
        path: 'answers.question',
        select: EXAM_QUESTION_FIELDS_BASIC
      });
    }

    // Calculate results
    let totalScore = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unattempted = 0;

    // Get question marks from exam (if custom marks are set) or use question default marks
    // Handle both Map and Object formats - normalize all keys to strings
    let examQuestionMarks = {};
    if (attempt.exam.questionMarks) {
      if (attempt.exam.questionMarks instanceof Map) {
        // Convert Map to object with string keys
        attempt.exam.questionMarks.forEach((value, key) => {
          examQuestionMarks[key.toString()] = parseFloat(value) || value;
        });
      } else {
        // It's already an object - Mongoose Maps are often returned as objects
        const qm = attempt.exam.questionMarks;
        // Convert all keys to strings for consistent lookup
        for (const key in qm) {
          if (qm.hasOwnProperty(key)) {
            // Convert key to string (handles both ObjectId and string keys)
            const keyStr = key.toString();
            examQuestionMarks[keyStr] = parseFloat(qm[key]) || qm[key];
          }
        }
      }
    }

    // Calculate marks per question from exam (priority: use exam's marks per question)
    // This is calculated as totalMarks / number of questions
    const examMarksPerQuestion = attempt.exam.totalMarks && attempt.exam.questions && attempt.exam.questions.length > 0
      ? attempt.exam.totalMarks / attempt.exam.questions.length
      : null;

    attempt.answers.forEach(answer => {
      const question = answer.question;
      const questionId = question._id.toString();

      // Look up marks - all keys are normalized to strings
      let questionMarks = examQuestionMarks[questionId];

      // If not found, try to find by comparing all keys (in case of ObjectId mismatch)
      if (questionMarks === undefined) {
        for (const key in examQuestionMarks) {
          // Compare both keys as strings
          if (key.toString() === questionId || key === questionId) {
            questionMarks = examQuestionMarks[key];
            break;
          }
        }
      }

      // Convert to number if it's a string
      if (questionMarks !== undefined) {
        questionMarks = parseFloat(questionMarks);
      }

      // Priority order for marks:
      // 1. exam.questionMarks[questionId] (explicit per-question marks)
      // 2. exam.totalMarks / exam.questions.length (marks per question for the exam) - THIS IS THE PRIORITY
      // 3. question.marks (from Question collection)
      // 4. 1 (default)
      if (questionMarks === undefined || isNaN(questionMarks)) {
        if (examMarksPerQuestion !== null && !isNaN(examMarksPerQuestion)) {
          // Use exam's marks per question (calculated from totalMarks / questionCount)
          questionMarks = examMarksPerQuestion;
        } else {
          // Fallback to question's default marks
          questionMarks = question.marks || 1;
        }
      }

      if (!answer.selectedAnswer) {
        unattempted++;
        answer.marksAwarded = 0;
        answer.marksDeducted = 0;
        answer.netMarks = 0;
      } else if (answer.selectedAnswer === question.correctAnswer) {
        answer.isCorrect = true;
        answer.marksAwarded = questionMarks;
        answer.marksDeducted = 0;
        answer.netMarks = questionMarks;
        totalScore += questionMarks;
        correctAnswers++;
      } else {
        answer.isCorrect = false;
        // Apply negative marking if enabled
        if (attempt.exam.enableNegativeMarking && attempt.exam.negativeMarksPerQuestion) {
          const deduction = Math.abs(parseFloat(attempt.exam.negativeMarksPerQuestion));
          answer.marksAwarded = 0;
          answer.marksDeducted = deduction;
          answer.netMarks = -deduction;
          totalScore -= deduction;
        } else {
          answer.marksAwarded = 0;
          answer.marksDeducted = 0;
          answer.netMarks = 0;
        }
        incorrectAnswers++;
      }
    });

    const endTime = new Date();
    const timeTaken = Math.floor((endTime - attempt.startTime) / 1000);
    const percentage = attempt.exam.totalMarks > 0
      ? (totalScore / attempt.exam.totalMarks) * 100
      : 0;

    attempt.endTime = endTime;
    attempt.timeTaken = timeTaken;
    attempt.totalScore = totalScore;
    attempt.correctAnswers = correctAnswers;
    attempt.incorrectAnswers = incorrectAnswers;
    attempt.unattempted = unattempted;
    attempt.percentage = percentage;
    attempt.isCompleted = true;

    await attempt.save();

    // Update study streak
    const { updateStudyStreak } = await import('../utils/streakManager.js');
    const streakUpdate = await updateStudyStreak(attempt.user);

    // Award XP, rank, and performance badges
    const { awardForAttempt } = await import('../utils/awardEngine.js');
    const rewards = await awardForAttempt(attempt.user, { correctAnswers, percentage });

    res.json({
      message: 'Exam submitted successfully',
      result: {
        attemptId: attempt._id,
        totalScore,
        totalMarks: attempt.exam.totalMarks,
        percentage: percentage.toFixed(2),
        correctAnswers,
        incorrectAnswers,
        unattempted,
        timeTaken
      },
      streak: streakUpdate,
      rewards
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const pauseExam = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    if (attempt.isCompleted) {
      return res.status(400).json({ message: 'Exam already submitted' });
    }

    if (attempt.isPaused) {
      return res.status(400).json({ message: 'Exam is already paused' });
    }

    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Save answers before pausing
    if (req.body.answers) {
      attempt.answers = req.body.answers;
    }

    attempt.isPaused = true;
    attempt.pausedAt = new Date();
    await attempt.save();

    res.json({
      message: 'Exam paused successfully',
      attempt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getResult = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.attemptId)
      .populate({
        path: 'exam',
        select: 'title duration totalMarks category subCategory language isPremium accessType averageRating reviewCount',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subCategory', select: 'name' },
        ],
      })
      .populate({
        path: 'answers.question',
        select: EXAM_QUESTION_FIELDS_BASIC
      });

    if (!attempt) {
      return res.status(404).json({ message: 'Result not found' });
    }

    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Get all previous attempts for this exam to show comparison
    const previousAttempts = await ExamAttempt.find({
      user: attempt.user,
      exam: attempt.exam._id,
      isCompleted: true,
      attemptNumber: { $lt: attempt.attemptNumber }
    })
      .select('_id totalScore percentage correctAnswers incorrectAnswers unattempted attemptNumber endTime createdAt')
      .sort({ attemptNumber: -1 })
      .lean();

    res.json({
      result: attempt,
      previousAttempts: previousAttempts || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/exams/active-attempt
// Most recent in-progress (not completed) attempt, for the Home "Resume" card.
export const getActiveAttempt = async (req, res) => {
  try {
    // Scan recent incomplete attempts and return the first whose exam still
    // exists and isn't deleted — otherwise the Home "Resume" card would offer
    // an exam that can't be started.
    const candidates = await ExamAttempt.find({
      user: req.user._id,
      isCompleted: false,
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate({
        path: 'exam',
        select: 'title duration totalMarks deleted',
      })
      .lean();

    const valid = candidates.find((c) => c.exam && c.exam.deleted !== true);
    if (!valid) {
      return res.json({ attempt: null });
    }
    const attempt = valid;

    const answeredCount = (attempt.answers || []).filter(
      (a) => a.selectedAnswer !== undefined && a.selectedAnswer !== null && a.selectedAnswer !== ''
    ).length;

    res.json({
      attempt: {
        attemptId: attempt._id,
        examId: attempt.exam._id,
        examTitle: attempt.exam.title,
        duration: attempt.exam.duration,
        totalMarks: attempt.exam.totalMarks,
        isPaused: attempt.isPaused,
        answeredCount,
        startTime: attempt.startTime,
        updatedAt: attempt.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

