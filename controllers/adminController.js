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
    const { title, description, category, scheduledTime, duration, questions, questionMarks, totalMarks, selectionMethod, subjects, questionCount, language = 'English', status = 'draft', allowReattempts = true, maxAttempts = 3, allowTabSwitch = false, enableNegativeMarking = false, negativeMarksPerQuestion = 0, randomizeQuestions = false, timePerQuestion = null, difficultyDistribution = { easy: 0, medium: 0, hard: 0 }, sections = [], tags = [] } = req.body;

    // Validate language
    if (language && !['Hindi', 'English', 'Both'].includes(language)) {
      return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
    }

    let selectedQuestions = [];

    // Handle sections - if sections are provided, collect questions from all sections
    let questionsFromSections = [];
    if (sections && Array.isArray(sections) && sections.length > 0) {
      sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          questionsFromSections = [...questionsFromSections, ...section.questions];
        }
      });
    }

    if (selectionMethod === 'manual' || (sections && sections.length > 0)) {
      // If sections exist, use questions from sections, otherwise use manual selection
      selectedQuestions = questionsFromSections.length > 0 ? questionsFromSections : (questions || []);
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

    // Calculate total marks from questionMarks if provided, otherwise use totalMarks from request or fallback to question count
    let calculatedTotalMarks;
    if (totalMarks) {
      calculatedTotalMarks = parseFloat(totalMarks);
    } else if (questionMarks && Object.keys(questionMarks).length > 0) {
      calculatedTotalMarks = Object.values(questionMarks).reduce(
        (sum, marks) => sum + (parseFloat(marks) || 0),
        0
      );
    } else {
      calculatedTotalMarks = selectedQuestions.length;
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

    // Ensure questionMarks keys are strings (Mongoose Map requires consistent key types)
    let normalizedQuestionMarks = {};
    if (questionMarks && typeof questionMarks === 'object') {
      for (const key in questionMarks) {
        if (questionMarks.hasOwnProperty(key)) {
          // Convert key to string for consistent storage
          normalizedQuestionMarks[key.toString()] = parseFloat(questionMarks[key]) || questionMarks[key];
        }
      }
    }

    const exam = new Exam({
      title,
      description: description || '',
      category,
      scheduledTime: scheduledDate,
      duration,
      questions: selectedQuestions,
      questionMarks: Object.keys(normalizedQuestionMarks).length > 0 ? normalizedQuestionMarks : {},
      totalMarks: calculatedTotalMarks,
      language: language || 'English',
      expiresAt,
      status: status,
      allowReattempts: allowReattempts !== undefined ? allowReattempts : true,
      maxAttempts: maxAttempts || 3,
      allowTabSwitch: allowTabSwitch !== undefined ? allowTabSwitch : false,
      enableNegativeMarking: enableNegativeMarking || false,
      negativeMarksPerQuestion: enableNegativeMarking ? (parseFloat(negativeMarksPerQuestion) || 0) : 0,
      randomizeQuestions: randomizeQuestions || false,
      timePerQuestion: timePerQuestion ? parseInt(timePerQuestion) : null,
      difficultyDistribution: difficultyDistribution || { easy: 0, medium: 0, hard: 0 },
      sections: sections || [],
      tags: tags || [],
      isTemplate: req.body.isTemplate || false,
      templateName: req.body.templateName || null,
      recurringSchedule: req.body.recurringSchedule || { enabled: false },
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
    const { status, category, includeDeleted } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    
    // Filter out soft-deleted exams by default
    // Include exams where deleted field doesn't exist (for backward compatibility)
    if (includeDeleted !== 'true') {
      query.$or = [
        { deleted: false },
        { deleted: { $exists: false } }
      ];
    }

    const exams = await Exam.find(query)
      .populate('questions', 'questionText marks')
      .populate('createdBy', 'name')
      .populate('deletedBy', 'name')
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
    if (req.body.description !== undefined) exam.description = req.body.description || '';
    if (req.body.category) exam.category = req.body.category;
    if (req.body.duration) exam.duration = req.body.duration;
    if (req.body.language) exam.language = req.body.language;
    if (req.body.questions) exam.questions = req.body.questions;
    if (req.body.questionMarks !== undefined) {
      exam.questionMarks = req.body.questionMarks || {};
      // Recalculate total marks
      const calculatedTotal = Object.values(exam.questionMarks).reduce((sum, marks) => sum + (parseFloat(marks) || 0), 0);
      exam.totalMarks = calculatedTotal || exam.questions.length;
    }
    if (req.body.totalMarks) exam.totalMarks = req.body.totalMarks;
    if (req.body.enableNegativeMarking !== undefined) exam.enableNegativeMarking = req.body.enableNegativeMarking;
    if (req.body.negativeMarksPerQuestion !== undefined) {
      exam.negativeMarksPerQuestion = req.body.enableNegativeMarking ? (parseFloat(req.body.negativeMarksPerQuestion) || 0) : 0;
    }
    if (req.body.allowReattempts !== undefined) exam.allowReattempts = req.body.allowReattempts;
    if (req.body.maxAttempts !== undefined) exam.maxAttempts = req.body.maxAttempts;
    if (req.body.allowTabSwitch !== undefined) exam.allowTabSwitch = req.body.allowTabSwitch;
    if (req.body.randomizeQuestions !== undefined) exam.randomizeQuestions = req.body.randomizeQuestions;
    if (req.body.timePerQuestion !== undefined) exam.timePerQuestion = req.body.timePerQuestion ? parseInt(req.body.timePerQuestion) : null;
    if (req.body.difficultyDistribution !== undefined) exam.difficultyDistribution = req.body.difficultyDistribution || { easy: 0, medium: 0, hard: 0 };
    if (req.body.sections !== undefined) exam.sections = req.body.sections || [];
    if (req.body.tags !== undefined) exam.tags = req.body.tags || [];
    if (req.body.isTemplate !== undefined) exam.isTemplate = req.body.isTemplate;
    if (req.body.templateName !== undefined) exam.templateName = req.body.templateName;
    if (req.body.recurringSchedule !== undefined) exam.recurringSchedule = req.body.recurringSchedule || { enabled: false };
    
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

    if (exam.deleted) {
      return res.status(400).json({ message: 'Cannot publish a deleted exam. Please restore it first.' });
    }

    if (exam.status === 'active' || exam.status === 'scheduled') {
      return res.status(400).json({ message: 'Exam is already published' });
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

export const unpublishExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (exam.deleted) {
      return res.status(400).json({ message: 'Cannot unpublish a deleted exam. Please restore it first.' });
    }

    if (exam.status === 'draft') {
      return res.status(400).json({ message: 'Exam is already in draft status' });
    }

    // Change status back to draft
    exam.status = 'draft';
    await exam.save();

    const populatedExam = await Exam.findById(exam._id)
      .populate('questions', 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic');

    res.json({ message: 'Exam unpublished successfully', exam: populatedExam });
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

    if (exam.deleted) {
      return res.status(400).json({ message: 'Exam is already deleted' });
    }

    // Soft delete - mark as deleted instead of removing
    exam.deleted = true;
    exam.deletedAt = new Date();
    exam.deletedBy = req.user._id;
    await exam.save();

    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const restoreExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (!exam.deleted) {
      return res.status(400).json({ message: 'Exam is not deleted' });
    }

    // Restore exam
    exam.deleted = false;
    exam.deletedAt = null;
    exam.deletedBy = null;
    await exam.save();

    const populatedExam = await Exam.findById(exam._id)
      .populate('questions', 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic');

    res.json({ message: 'Exam restored successfully', exam: populatedExam });
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

// Get exam templates
export const getExamTemplates = async (req, res) => {
  try {
    const templates = await Exam.find({ isTemplate: true, deleted: { $ne: true } })
      .select('title templateName category duration language marksPerQuestion randomizeQuestions timePerQuestion difficultyDistribution sections tags createdAt')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ templates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get question bank statistics
export const getQuestionBankStats = async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    if (category) query.category = category;

    const totalQuestions = await Question.countDocuments(query);
    
    // Difficulty distribution
    const difficultyStats = await Question.aggregate([
      { $match: query },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    // Category distribution
    const categoryStats = await Question.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Subject distribution
    const subjectStats = await Question.aggregate([
      { $match: query },
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    // Language distribution
    const languageStats = await Question.aggregate([
      { $match: query },
      { $group: { _id: '$language', count: { $sum: 1 } } }
    ]);

    // Usage statistics (questions used in exams)
    const usageStats = await Exam.aggregate([
      { $unwind: '$questions' },
      { $group: { _id: '$questions', examCount: { $sum: 1 } } },
      { $group: { _id: null, usedQuestions: { $sum: 1 }, totalUsage: { $sum: '$examCount' } } }
    ]);

    // Average marks
    const avgMarksResult = await Question.aggregate([
      { $match: query },
      { $group: { _id: null, avgMarks: { $avg: '$marks' } } }
    ]);

    const stats = {
      totalQuestions,
      difficultyDistribution: {
        easy: difficultyStats.find(d => d._id === 'Easy')?.count || 0,
        medium: difficultyStats.find(d => d._id === 'Medium')?.count || 0,
        hard: difficultyStats.find(d => d._id === 'Hard')?.count || 0,
        notSet: difficultyStats.find(d => !d._id)?.count || 0
      },
      categoryDistribution: categoryStats.reduce((acc, cat) => {
        acc[cat._id] = cat.count;
        return acc;
      }, {}),
      subjectDistribution: subjectStats.reduce((acc, subj) => {
        acc[subj._id || 'Not Set'] = subj.count;
        return acc;
      }, {}),
      languageDistribution: languageStats.reduce((acc, lang) => {
        acc[lang._id || 'Not Set'] = lang.count;
        return acc;
      }, {}),
      usage: {
        usedQuestions: usageStats[0]?.usedQuestions || 0,
        unusedQuestions: totalQuestions - (usageStats[0]?.usedQuestions || 0),
        totalUsage: usageStats[0]?.totalUsage || 0
      },
      averageMarks: avgMarksResult[0]?.avgMarks || 1
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get exam analytics (preview before creating)
export const getExamAnalytics = async (req, res) => {
  try {
    const { questionIds } = req.body;
    
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ message: 'Question IDs array is required' });
    }

    const questions = await Question.find({ _id: { $in: questionIds } })
      .select('difficulty marks questionText');

    if (questions.length === 0) {
      return res.status(404).json({ message: 'No questions found' });
    }

    // Calculate statistics
    const totalQuestions = questions.length;
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const avgMarks = totalMarks / totalQuestions;

    // Difficulty distribution
    const difficultyCounts = {
      easy: questions.filter(q => q.difficulty === 'Easy').length,
      medium: questions.filter(q => q.difficulty === 'Medium').length,
      hard: questions.filter(q => q.difficulty === 'Hard').length,
      notSet: questions.filter(q => !q.difficulty).length
    };

    const difficultyPercentages = {
      easy: (difficultyCounts.easy / totalQuestions) * 100,
      medium: (difficultyCounts.medium / totalQuestions) * 100,
      hard: (difficultyCounts.hard / totalQuestions) * 100,
      notSet: (difficultyCounts.notSet / totalQuestions) * 100
    };

    // Estimated difficulty (weighted average)
    const difficultyWeights = { Easy: 1, Medium: 2, Hard: 3 };
    const weightedSum = questions.reduce((sum, q) => {
      const weight = difficultyWeights[q.difficulty] || 1.5;
      return sum + weight;
    }, 0);
    const estimatedDifficulty = weightedSum / totalQuestions;
    
    let difficultyLevel = 'Medium';
    if (estimatedDifficulty < 1.5) difficultyLevel = 'Easy';
    else if (estimatedDifficulty > 2.5) difficultyLevel = 'Hard';

    // Estimated average time (based on difficulty and marks)
    // Rough estimates: Easy = 1 min/mark, Medium = 1.5 min/mark, Hard = 2 min/mark
    const estimatedTime = questions.reduce((sum, q) => {
      const marks = q.marks || 1;
      let timePerMark = 1;
      if (q.difficulty === 'Medium') timePerMark = 1.5;
      else if (q.difficulty === 'Hard') timePerMark = 2;
      return sum + (marks * timePerMark);
    }, 0);

    const analytics = {
      totalQuestions,
      totalMarks,
      averageMarks: avgMarks.toFixed(2),
      difficultyDistribution: {
        counts: difficultyCounts,
        percentages: difficultyPercentages
      },
      estimatedDifficulty: difficultyLevel,
      estimatedAverageTime: Math.round(estimatedTime),
      estimatedTimeRange: {
        min: Math.round(estimatedTime * 0.7), // 70% of estimated time
        max: Math.round(estimatedTime * 1.3)  // 130% of estimated time
      }
    };

    res.json({ analytics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

