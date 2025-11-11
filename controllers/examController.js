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
    
    const exams = await Exam.find({
      category: { $in: user.examPreparations },
      status: { $in: ['scheduled', 'active'] },
      scheduledTime: { $lte: now },
      expiresAt: { $gte: now }
    })
    .populate('questions', 'questionText marks')
    .sort({ scheduledTime: -1 });

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
    const exam = await Exam.findById(req.params.id)
      .populate({
        path: 'questions',
        select: 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic'
      });
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    res.json({ exam });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const startExam = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if already attempted
    const existingAttempt = await ExamAttempt.findOne({
      user: user._id,
      exam: exam._id,
      isCompleted: true
    });
    
    if (existingAttempt) {
      return res.status(400).json({ message: 'Exam already attempted' });
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
    if (exam.expiresAt && exam.expiresAt < now) {
      return res.status(400).json({ message: 'Exam has expired' });
    }

    // Create or get existing attempt
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
        startTime: new Date()
      });
      await attempt.save();

      // Increment weekly count
      updatedUser.weeklyExamsAttempted += 1;
      await updatedUser.save();
      
      // Populate questions after save
      attempt = await ExamAttempt.findById(attempt._id)
        .populate({
          path: 'answers.question',
          select: 'questionText questionTextHindi options optionsHindi correctAnswer explanation explanationHindi marks questionImage language'
        });
    }

    res.json({ attempt });
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
      }
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

    res.json({ result: attempt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

