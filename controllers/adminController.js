import Question from '../models/Question.js';
import Exam from '../models/Exam.js';
import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Subscription from '../models/Subscription.js';
import SubjectTopic from '../models/SubjectTopic.js';
import { generateQuestions } from '../utils/aiQuestionGenerator.js';
import cloudinary from '../config/cloudinary.js';

// Helper function to save/update subject-topic combination
const saveSubjectTopic = async (subject, topic, category) => {
  try {
    const topicValue = topic || '';
    await SubjectTopic.findOneAndUpdate(
      { subject: subject.trim(), topic: topicValue.trim(), category },
      { 
        $inc: { usageCount: 1 },
        $set: { lastUsed: new Date() }
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error saving subject-topic:', error);
    // Don't throw - this is not critical
  }
};

// Question Management
export const addQuestion = async (req, res) => {
  try {
    // Handle multer/Cloudinary errors
    if (req.fileError) {
      return res.status(400).json({ 
        message: req.fileError.message || 'File upload failed',
        error: req.fileError.message
      });
    }

    const questionData = {
      ...req.body,
      createdBy: req.user._id
    };

    if (req.file) {
      // req.file.path is set by CloudinaryStorage
      questionData.questionImage = req.file.path;
      console.log('File uploaded successfully:', req.file.path);
    }

    const question = new Question(questionData);
    await question.save();

    // Save subject-topic combination
    await saveSubjectTopic(questionData.subject, questionData.topic, questionData.category);

    res.status(201).json({ message: 'Question added successfully', question });
  } catch (error) {
    console.error('Error adding question:', error);
    
    // Check for Cloudinary-specific errors
    if (error.message && error.message.includes('api_key')) {
      return res.status(500).json({ 
        message: 'Cloudinary configuration error. Please check your API credentials in .env file.',
        error: 'Must supply api_key'
      });
    }
    
    res.status(500).json({ 
      message: error.message || 'Failed to add question',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getQuestions = async (req, res) => {
  try {
    const { category, subject, difficulty, page = 1, limit = 50 } = req.query;
    const query = {};

    if (category) query.category = category;
    if (subject) query.subject = subject;
    if (difficulty) query.difficulty = difficulty;

    const questions = await Question.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    Object.assign(question, req.body);
    
    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (question.questionImage) {
        try {
          const publicId = question.questionImage.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (deleteError) {
          console.error('Error deleting old image:', deleteError);
          // Continue even if deletion fails
        }
      }
      question.questionImage = req.file.path;
      console.log('File uploaded successfully:', req.file.path);
    }

    await question.save();

    // Update subject-topic combination
    await saveSubjectTopic(question.subject, question.topic, question.category);

    res.json({ message: 'Question updated successfully', question });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to update question',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    await question.deleteOne();

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;
    
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({ message: 'Question IDs array is required' });
    }

    await Question.deleteMany({ _id: { $in: questionIds } });

    res.json({ message: 'Questions deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// AI Question Generation
export const generateAIGuestions = async (req, res) => {
  try {
    const { examType, subject, topic, count, difficulty, language = 'English' } = req.body;

    if (!examType || !subject || !count || !difficulty) {
      return res.status(400).json({ 
        message: 'examType, subject, count, and difficulty are required' 
      });
    }

    if (count < 1 || count > 50) {
      return res.status(400).json({ message: 'Count must be between 1 and 50' });
    }

    if (!['Hindi', 'English', 'Both'].includes(language)) {
      return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
    }

    const questions = await generateQuestions(examType, subject, topic, count, difficulty, language);

    res.json({ 
      message: 'Questions generated successfully',
      questions: questions.map(q => ({
        ...q,
        topic: topic || q.topic || '',
        isAIGenerated: true,
        createdBy: req.user._id
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveAIGuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ message: 'Questions array is required' });
    }

    const savedQuestions = await Question.insertMany(
      questions.map(q => ({
        ...q,
        createdBy: req.user._id
      }))
    );

    // Save subject-topic combinations for all saved questions
    for (const question of savedQuestions) {
      await saveSubjectTopic(question.subject, question.topic, question.category);
    }

    res.json({ 
      message: 'Questions saved successfully',
      count: savedQuestions.length,
      questions: savedQuestions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Exam Management
export const createExam = async (req, res) => {
  try {
    const { title, category, scheduledTime, duration, questions, totalMarks, selectionMethod, subjects, questionCount, language = 'English', status = 'draft' } = req.body;

    // Validate language
    if (language && !['Hindi', 'English', 'Both'].includes(language)) {
      return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
    }

    let selectedQuestions = [];

    if (selectionMethod === 'manual') {
      selectedQuestions = questions || [];
    } else if (selectionMethod === 'auto') {
      const query = { category };
      if (subjects && subjects.length > 0) {
        query.subject = { $in: subjects };
      }
      if (language && language !== 'Both') {
        query.$or = [
          { language: language },
          { language: 'Both' }
        ];
      }
      
      const availableQuestions = await Question.find(query);
      const shuffled = availableQuestions.sort(() => 0.5 - Math.random());
      selectedQuestions = shuffled.slice(0, questionCount || 50).map(q => q._id);
    }

    if (selectedQuestions.length === 0) {
      return res.status(400).json({ message: 'No questions selected' });
    }

    // Handle scheduledTime based on status
    let scheduledDate;
    let expiresAt;
    
    if (status === 'scheduled') {
      // Auto-schedule: set to current time to ensure immediate availability
      scheduledDate = new Date(Date.now());
      // Don't set expiration - exams stay available indefinitely
      expiresAt = null;
    } else {
      // Draft: use provided scheduledTime or set to future date
      if (scheduledTime) {
        // If it's already an ISO string (from frontend conversion), use it directly
        if (typeof scheduledTime === 'string' && scheduledTime.includes('T') && scheduledTime.includes('Z')) {
          scheduledDate = new Date(scheduledTime);
        } else {
          // Convert to Date - if it's ISO string, it will be parsed correctly
          scheduledDate = new Date(scheduledTime);
        }
      } else {
        scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      // Don't set expiration for draft exams - they can be scheduled later
      expiresAt = null;
    }

    const exam = new Exam({
      title,
      category,
      scheduledTime: scheduledDate,
      duration,
      questions: selectedQuestions,
      totalMarks: totalMarks || selectedQuestions.length,
      language: language || 'English',
      expiresAt,
      status: status,
      createdBy: req.user._id
    });

    await exam.save();

    const populatedExam = await Exam.findById(exam._id)
      .populate('questions', 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic');

    res.status(201).json({ 
      message: 'Exam created successfully', 
      exam: populatedExam,
      selectedQuestions: selectedQuestions.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExams = async (req, res) => {
  try {
    const { status, category } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;

    const exams = await Exam.find(query)
      .populate('questions', 'questionText marks')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ exams });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (exam.status !== 'draft') {
      return res.status(400).json({ message: 'Can only edit draft exams' });
    }

    // Update fields
    if (req.body.title) exam.title = req.body.title;
    if (req.body.category) exam.category = req.body.category;
    if (req.body.duration) exam.duration = req.body.duration;
    if (req.body.language) exam.language = req.body.language;
    if (req.body.questions) exam.questions = req.body.questions;
    if (req.body.totalMarks) exam.totalMarks = req.body.totalMarks;
    
    // Handle scheduledTime
    if (req.body.scheduledTime) {
      // If it's already an ISO string (from frontend conversion), use it directly
      // Otherwise, treat it as local time and convert properly
      let scheduledDate;
      if (typeof req.body.scheduledTime === 'string' && req.body.scheduledTime.includes('T') && req.body.scheduledTime.includes('Z')) {
        // Already in ISO format with timezone
        scheduledDate = new Date(req.body.scheduledTime);
      } else {
        // Convert to Date - if it's ISO string, it will be parsed correctly
        scheduledDate = new Date(req.body.scheduledTime);
      }
      exam.scheduledTime = scheduledDate;
      // Don't set expiration - exams stay available indefinitely
      exam.expiresAt = null;
    }

    // Recalculate totalMarks if questions changed
    if (req.body.questions && req.body.questions.length > 0) {
      exam.totalMarks = req.body.totalMarks || req.body.questions.length;
    }

    await exam.save();

    const populatedExam = await Exam.findById(exam._id)
      .populate('questions', 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic');

    res.json({ message: 'Exam updated successfully', exam: populatedExam });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const publishExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (exam.status !== 'draft') {
      return res.status(400).json({ message: 'Can only publish draft exams' });
    }

    if (!exam.scheduledTime) {
      return res.status(400).json({ message: 'Exam must have a scheduled time before publishing' });
    }

    // Update status to scheduled
    exam.status = 'scheduled';
    await exam.save();

    const populatedExam = await Exam.findById(exam._id)
      .populate('questions', 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic');

    res.json({ message: 'Exam published successfully', exam: populatedExam });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (exam.status !== 'draft') {
      return res.status(400).json({ message: 'Can only delete draft exams' });
    }

    await exam.deleteOne();

    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get subjects and topics
export const getSubjectsAndTopics = async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    
    if (category) {
      query.category = category;
    }

    const subjectTopics = await SubjectTopic.find(query)
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(1000);

    // Group by subject
    const grouped = {};
    subjectTopics.forEach(st => {
      if (!grouped[st.subject]) {
        grouped[st.subject] = {
          subject: st.subject,
          topics: [],
          category: st.category
        };
      }
      if (st.topic && !grouped[st.subject].topics.includes(st.topic)) {
        grouped[st.subject].topics.push(st.topic);
      }
    });

    // Convert to array and sort topics by usage
    const result = Object.values(grouped).map(item => ({
      ...item,
      topics: item.topics.sort()
    }));

    res.json({ subjectsAndTopics: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin Dashboard
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalQuestions = await Question.countDocuments();
    const totalExams = await Exam.countDocuments({ status: { $ne: 'draft' } });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttempts = await ExamAttempt.countDocuments({
      createdAt: { $gte: today },
      isCompleted: true
    });

    const recentSubscriptions = await Subscription.find({ status: 'active' })
      .populate('user', 'name phoneNumber')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalUsers,
      totalQuestions,
      totalExams,
      todayAttempts,
      recentSubscriptions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User Management
export const getUsers = async (req, res) => {
  try {
    const { subscriptionStatus, search, page = 1, limit = 50 } = req.query;
    const query = { role: 'user' };

    if (subscriptionStatus) {
      query.subscriptionStatus = subscriptionStatus;
    }

    if (search) {
      query.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upgrade User Subscription
export const upgradeUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan, duration } = req.body; // plan: 'monthly' or 'yearly', duration in months

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan. Must be monthly or yearly' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate expiry date
    const now = new Date();
    const months = plan === 'monthly' ? 1 : 12;
    
    // If user already has premium and subscription hasn't expired, extend from current expiry
    // Otherwise, start from now
    let expiryDate;
    if (user.subscriptionStatus === 'premium' && user.subscriptionExpiry && new Date(user.subscriptionExpiry) > now) {
      expiryDate = new Date(user.subscriptionExpiry);
      expiryDate.setMonth(expiryDate.getMonth() + months);
    } else {
      expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + months);
    }

    // Update user subscription
    user.subscriptionStatus = 'premium';
    user.subscriptionExpiry = expiryDate;
    await user.save();

    // Create subscription record
    const subscription = new Subscription({
      user: user._id,
      plan: plan,
      amount: 0, // Admin upgrade, no payment
      paymentId: `admin_upgrade_${Date.now()}`,
      orderId: `admin_order_${Date.now()}`,
      status: 'active',
      startDate: now,
      endDate: expiryDate,
      autoRenew: false,
    });
    await subscription.save();

    res.json({
      message: `User subscription upgraded to ${plan} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// File Upload
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
      message: 'File uploaded successfully',
      url: req.file.path,
      publicId: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

