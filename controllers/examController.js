import Exam from '../models/Exam.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Question from '../models/Question.js';
import User from '../models/User.js';

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
    
    // Get available exams - exams that have started and not expired
    // Account for IST timezone (UTC+5:30) - MongoDB stores in UTC
    const exams = await Exam.find({
      category: { $in: user.examPreparations },
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: { $lte: now }, // Already started
      $or: [
        { expiresAt: { $gte: now } }, // Has expiration and not expired yet
        { expiresAt: null }, // No expiration set (available indefinitely)
        { expiresAt: { $exists: false } } // expiresAt field doesn't exist
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
      exam = await Exam.findById(req.params.id)
        .populate({
          path: 'questions',
          select: 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic'
        });
    } else {
      // Don't populate questions - just get exam metadata
      exam = await Exam.findById(req.params.id)
        .select('-questions'); // Exclude questions array
      
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
    const canReattempt = exam.allowReattempts && attemptCount < exam.maxAttempts;

    res.json({ 
      exam,
      attemptStatus: {
        isCompleted: attemptCount > 0,
        isPaused: !!pausedAttempt,
        completedAttemptId: latestAttempt?._id,
        pausedAttemptId: pausedAttempt?._id,
        attemptCount,
        canReattempt,
        maxAttempts: exam.maxAttempts,
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
    const exam = await Exam.findById(req.params.id)
      .populate({
        path: 'questions',
        select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language difficulty category subject topic'
      });
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
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
      select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language'
    });

    if (!attempt) {
      // Calculate next attempt number
      const nextAttemptNumber = attemptCount + 1;
      
      // Initialize answers array
      const answers = exam.questions.map(question => ({
        question: question,
        selectedAnswer: null,
        isCorrect: false,
        marksObtained: 0
      }));

      attempt = new ExamAttempt({
        user: user._id,
        exam: exam._id,
        answers,
        startTime: new Date(),
        attemptNumber: nextAttemptNumber
      });
      await attempt.save();

      // Increment weekly count only for new attempts
      updatedUser.weeklyExamsAttempted += 1;
      await updatedUser.save();
      
      // Populate questions after save
      attempt = await ExamAttempt.findById(attempt._id)
        .populate({
          path: 'answers.question',
          select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language'
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

    // Return exam with populated questions so frontend doesn't need to call getExamDetails again
    res.json({ 
      attempt, 
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
        select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language'
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

    // Calculate results
    let totalScore = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unattempted = 0;

    attempt.answers.forEach(answer => {
      const question = answer.question;
      if (!answer.selectedAnswer) {
        unattempted++;
      } else if (answer.selectedAnswer === question.correctAnswer) {
        answer.isCorrect = true;
        answer.marksObtained = question.marks || 1;
        totalScore += answer.marksObtained;
        correctAnswers++;
      } else {
        answer.isCorrect = false;
        answer.marksObtained = 0;
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
      streak: streakUpdate
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
      .populate('exam')
      .populate({
        path: 'answers.question',
        select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language'
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

