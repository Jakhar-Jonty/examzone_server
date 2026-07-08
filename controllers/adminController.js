import mongoose from 'mongoose';
import Question from '../models/Question.js';
import Exam from '../models/Exam.js';
import User from '../models/User.js';
import ExamAttempt from '../models/ExamAttempt.js';
import Subscription from '../models/Subscription.js';
import SubjectTopic from '../models/SubjectTopic.js';
import { generateQuestions, translateQuestionContent } from '../utils/aiQuestionGenerator.js';
import cloudinary from '../config/cloudinary.js';

// Helper function to save/update subject-topic combination
const saveSubjectTopic = async (subject, topic, category, subCategory = null, tier = null) => {
  try {
    const topicValue = topic || '';
    await SubjectTopic.findOneAndUpdate(
      {
        subject: subject.trim(),
        topic: topicValue.trim(),
        category,
        subCategory: subCategory || null,
        tier: tier || null
      },
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

// ============================================================
// AI TRANSLATION ENDPOINT
// ============================================================
export const translateQuestion = async (req, res) => {
  try {
    const { text, fromLanguage, toLanguage, options, explanation, detailedSolution } = req.body;

    if (!text || !fromLanguage || !toLanguage) {
      return res.status(400).json({ message: 'text, fromLanguage, and toLanguage are required' });
    }

    const validLanguages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Gujarati'];
    if (!validLanguages.includes(fromLanguage) || !validLanguages.includes(toLanguage)) {
      return res.status(400).json({ message: `Language must be one of: ${validLanguages.join(', ')}` });
    }

    // Build content object to translate
    const contentToTranslate = {
      questionText: text,
      ...(options && options.length > 0 ? { options } : {}),
      ...(explanation ? { explanation } : {}),
      ...(detailedSolution ? { detailedSolution } : {})
    };

    const translated = await translateQuestionContent(contentToTranslate, fromLanguage, toLanguage);

    res.json({
      message: 'Translation successful',
      translation: {
        questionText: translated.questionText || '',
        options: translated.options || [],
        explanation: translated.explanation || '',
        detailedSolution: translated.detailedSolution || ''
      }
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ message: error.message || 'Translation failed' });
  }
};

// ============================================================
// Question Management
// ============================================================
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

    // Convert empty strings to null for optional ObjectId fields
    if (questionData.subCategory === '' || questionData.subCategory === 'none') {
      questionData.subCategory = null;
    }
    if (questionData.tier === '' || questionData.tier === 'none') {
      questionData.tier = null;
    }

    // Parse JSON-stringified fields sent via FormData
    if (typeof questionData.translations === 'string') {
      try { questionData.translations = JSON.parse(questionData.translations); } catch { questionData.translations = []; }
    }
    if (typeof questionData.tags === 'string') {
      try { questionData.tags = JSON.parse(questionData.tags); } catch { questionData.tags = []; }
    }
    if (typeof questionData.options === 'string') {
      try { questionData.options = JSON.parse(questionData.options); } catch { questionData.options = []; }
    }
    if (typeof questionData.acceptableAnswers === 'string') {
      try { questionData.acceptableAnswers = JSON.parse(questionData.acceptableAnswers); } catch { questionData.acceptableAnswers = []; }
    }
    if (typeof questionData.matchPairs === 'string') {
      try { questionData.matchPairs = JSON.parse(questionData.matchPairs); } catch { questionData.matchPairs = []; }
    }
    if (typeof questionData.correctAnswers === 'string') {
      try { questionData.correctAnswers = JSON.parse(questionData.correctAnswers); } catch { questionData.correctAnswers = []; }
    }
    // Remove undefined/empty optional fields
    if (!questionData.bloomsTaxonomy) delete questionData.bloomsTaxonomy;
    if (!questionData.cognitiveLevel) delete questionData.cognitiveLevel;
    if (!questionData.status) questionData.status = 'Draft';

    if (req.file) {
      // req.file.path is set by CloudinaryStorage
      questionData.questionImage = req.file.path;
      console.log('File uploaded successfully:', req.file.path);
    }

    console.log('Saving question with data:', {
      category: questionData.category,
      subCategory: questionData.subCategory,
      tier: questionData.tier
    });

    const question = new Question(questionData);
    await question.save();

    console.log('Question saved:', {
      _id: question._id,
      category: question.category,
      subCategory: question.subCategory,
      tier: question.tier
    });

    // Save subject-topic combination
    await saveSubjectTopic(
      questionData.subject,
      questionData.topic,
      questionData.category,
      questionData.subCategory,
      questionData.tier
    );

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
    const {
      category, subCategory, tier, subject, topic, subTopic, difficulty, questionType,
      isPYQ, sourceExam, sourceYear, paperSet, chapter,
      status,         // Filter by question status (e.g., 'Published', 'Draft')
      bloomsTaxonomy, // Filter by Bloom's Taxonomy level
      ids, // Support fetching by specific IDs (comma-separated)
      page = 1, limit = 50
    } = req.query;
    const query = {};

    // If ids parameter is provided, fetch specific questions by ID
    if (ids) {
      const idArray = ids.split(',').map(id => id.trim()).filter(id => id);
      if (idArray.length > 0) {
        // Convert string IDs to ObjectIds for MongoDB query
        const objectIds = idArray.map(id => {
          try {
            return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
          } catch (e) {
            return id;
          }
        });
        query._id = { $in: objectIds };
        // When fetching by IDs, ignore pagination and return all matching questions
        const questions = await Question.find(query)
          .populate('category', 'name code')
          .populate('subCategory', 'name code')
          .populate('tier', 'name code')
          .populate('createdBy', 'name')
          .sort({ createdAt: -1 });

        return res.json({
          questions,
          totalPages: 1,
          currentPage: 1,
          total: questions.length
        });
      }
    }

    // Hierarchical filtering: match questions at the selected level and below
    // If category is provided, it must match
    if (category && category !== 'none' && category !== '') {
      query.category = category;
    }

    // If subCategory is provided, it must match exactly
    if (subCategory && subCategory !== 'none' && subCategory !== '') {
      query.subCategory = subCategory;
    }

    // If tier is provided, it must match exactly
    if (tier && tier !== 'none' && tier !== '') {
      query.tier = tier;
    }

    // Debug logging
    console.log('=== Question Query Debug ===');
    console.log('Query params received:', { category, subCategory, tier });
    console.log('MongoDB query built:', JSON.stringify(query, null, 2));

    // Also log a sample of what's in the database
    if (category) {
      const sampleQuestions = await Question.find({ category })
        .select('category subCategory tier')
        .populate('category', 'name')
        .populate('subCategory', 'name')
        .populate('tier', 'name')
        .limit(3)
        .lean();
      console.log(`Sample questions in DB (category=${category}):`,
        sampleQuestions.map(q => ({
          category: q.category?.name || q.category,
          subCategory: q.subCategory?.name || q.subCategory,
          tier: q.tier?.name || q.tier
        }))
      );
    }

    if (subject) query.subject = new RegExp(subject, 'i');
    if (topic) query.topic = new RegExp(topic, 'i');
    if (subTopic) query.subTopic = new RegExp(subTopic, 'i');
    if (chapter) query.chapter = new RegExp(chapter, 'i');
    if (difficulty) query.difficulty = difficulty;
    if (questionType) query.questionType = questionType;
    if (status) query.status = status;
    if (bloomsTaxonomy) query.bloomsTaxonomy = bloomsTaxonomy;

    // PYQ filtering
    if (isPYQ !== undefined) query.isPYQ = isPYQ === 'true';
    if (sourceExam) query.sourceExam = new RegExp(sourceExam, 'i');
    if (sourceYear) query.sourceYear = parseInt(sourceYear);
    if (paperSet) query.paperSet = paperSet;

    const questions = await Question.find(query)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Question.countDocuments(query);

    console.log(`Found ${total} questions matching query`);
    if (questions.length > 0) {
      console.log('First question sample:', {
        _id: questions[0]._id,
        category: questions[0].category?.name || questions[0].category,
        subCategory: questions[0].subCategory?.name || questions[0].subCategory,
        tier: questions[0].tier?.name || questions[0].tier
      });
    }

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

export const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({ question });
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

    const updateData = { ...req.body };

    // Parse JSON-stringified fields sent via FormData
    if (typeof updateData.translations === 'string') {
      try { updateData.translations = JSON.parse(updateData.translations); } catch { updateData.translations = []; }
    }
    if (typeof updateData.tags === 'string') {
      try { updateData.tags = JSON.parse(updateData.tags); } catch { updateData.tags = []; }
    }
    if (typeof updateData.options === 'string') {
      try { updateData.options = JSON.parse(updateData.options); } catch { updateData.options = []; }
    }
    if (typeof updateData.matchPairs === 'string') {
      try { updateData.matchPairs = JSON.parse(updateData.matchPairs); } catch { updateData.matchPairs = []; }
    }
    if (typeof updateData.correctAnswers === 'string') {
      try { updateData.correctAnswers = JSON.parse(updateData.correctAnswers); } catch { updateData.correctAnswers = []; }
    }
    if (!updateData.bloomsTaxonomy) delete updateData.bloomsTaxonomy;
    if (!updateData.cognitiveLevel) delete updateData.cognitiveLevel;

    Object.assign(question, updateData);

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
    await saveSubjectTopic(
      question.subject,
      question.topic,
      question.category,
      question.subCategory,
      question.tier
    );

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
    const { category, subCategory, tier, subject, topic, subTopic, chapter, count, difficulty, language = 'English', bloomsTaxonomy = '', questionType = 'MCQ' } = req.body;

    if (!category || !subject || !count || !difficulty) {
      return res.status(400).json({
        message: 'category, subject, count, and difficulty are required'
      });
    }

    if (count < 1 || count > 50) {
      return res.status(400).json({ message: 'Count must be between 1 and 50' });
    }

    if (!['Hindi', 'English', 'Both'].includes(language)) {
      return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
    }

    // Fetch category name for the prompt
    const Category = (await import('../models/Category.js')).default;
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    let categoryName = categoryDoc.name;
    if (subCategory) {
      const subCat = categoryDoc.subCategories?.find(sc => sc._id.toString() === subCategory);
      if (subCat) {
        categoryName += ` ${subCat.name}`;
      }
    }
    if (tier) {
      const Tier = (await import('../models/Tier.js')).default;
      const tierDoc = await Tier.findById(tier);
      if (tierDoc) {
        categoryName += ` ${tierDoc.name}`;
      }
    }

    const questions = await generateQuestions(categoryName, subject, topic || '', count, difficulty, language, subTopic || '', chapter || '', questionType, bloomsTaxonomy || '');

    res.json({
      message: 'Questions generated successfully',
      questions: questions.map(q => ({
        ...q,
        category: category,
        subCategory: subCategory || null,
        tier: tier || null,
        topic: topic || q.topic || '',
        subTopic: subTopic || q.subTopic || '',
        chapter: chapter || q.chapter || '',
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

    // Prepare questions for insertion using new schema (translations[] format)
    const questionsToSave = questions.map(q => {
      const questionData = {
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        detailedSolution: q.detailedSolution || undefined,
        subject: q.subject,
        topic: q.topic || undefined,
        subTopic: q.subTopic || undefined,
        chapter: q.chapter || undefined,
        category: q.category,
        subCategory: q.subCategory || null,
        tier: q.tier || null,
        difficulty: q.difficulty || 'Medium',
        marks: q.marks || 1,
        language: q.language || 'English',
        questionType: q.questionType || 'MCQ',
        isAIGenerated: true,
        humanVerified: false,
        status: 'Draft',
        // New schema: translations array
        translations: Array.isArray(q.translations) ? q.translations : [],
        // Optional metadata (set by AI, admin can edit later)
        bloomsTaxonomy: q.bloomsTaxonomy || undefined,
        cognitiveLevel: q.cognitiveLevel || undefined,
        estimatedTime: q.estimatedTime || undefined,
        tags: Array.isArray(q.tags) ? q.tags : [],
        createdBy: req.user._id
      };

      // Remove undefined fields
      Object.keys(questionData).forEach(key => {
        if (questionData[key] === undefined) {
          delete questionData[key];
        }
      });

      return questionData;
    });

    const savedQuestions = await Question.insertMany(questionsToSave);

    // Save subject-topic combinations for all saved questions
    for (const question of savedQuestions) {
      await saveSubjectTopic(
        question.subject,
        question.topic,
        question.category,
        question.subCategory,
        question.tier
      );
    }

    res.json({
      message: 'Questions saved successfully',
      count: savedQuestions.length,
      questions: savedQuestions
    });
  } catch (error) {
    console.error('Error saving AI questions:', error);
    res.status(500).json({ message: error.message });
  }
};

// Exam Management
export const createExam = async (req, res) => {
  try {
    const { title, description, category, subCategory, tier, scheduledTime, duration, questions, questionMarks, totalMarks, selectionMethod, subjects, questionCount, language = 'English', status = 'draft', allowReattempts = true, maxAttempts = 3, allowTabSwitch = false, enableNegativeMarking = false, negativeMarksPerQuestion = 0, randomizeQuestions = false, timePerQuestion = null, difficultyDistribution = { easy: 0, medium: 0, hard: 0 }, sections = [], tags = [], enableSectionTiming = false, enableSectionLocking = false } = req.body;

    // Validate language
    if (language && !['Hindi', 'English', 'Both'].includes(language)) {
      return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
    }

    let selectedQuestions = [];

    // Handle sections - if sections are provided, collect questions from all sections
    // Also ensure sections have questionCount preserved (important for templates)
    let questionsFromSections = [];
    let processedSections = sections || [];
    if (sections && Array.isArray(sections) && sections.length > 0) {
      sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          questionsFromSections = [...questionsFromSections, ...section.questions];
        }
      });
      // Ensure each section has questionCount preserved (for templates)
      processedSections = sections.map(section => ({
        ...section,
        questionCount: section.questionCount !== undefined && section.questionCount !== null
          ? parseInt(section.questionCount) || 0
          : (section.questions?.length || 0)
      }));
    }

    if (selectionMethod === 'manual' || (processedSections && processedSections.length > 0) || (questions && questions.length > 0)) {
      // If sections exist, use questions from sections, otherwise use manual selection
      if (processedSections && processedSections.length > 0 && questionsFromSections.length > 0) {
        selectedQuestions = questionsFromSections;
      } else {
        selectedQuestions = questions || [];
      }
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

    // Validate questions are selected (templates are now handled separately)
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

    // For exams with section-wise timing, calculate duration from sections if not provided
    let finalDuration = duration;
    if (enableSectionTiming && processedSections && processedSections.length > 0 && (!duration || duration === 0)) {
      finalDuration = processedSections.reduce((sum, section) => sum + (parseInt(section.timeLimit) || 0), 0);
    }
    // Ensure duration is set (required field) - default to 60 minutes for exams
    if (!finalDuration || finalDuration === 0) {
      finalDuration = duration || 60; // Default to 60 minutes for exams
    }

    const exam = new Exam({
      title,
      description: description || '',
      category,
      subCategory: subCategory || null,
      tier: tier || null,
      scheduledTime: scheduledDate,
      duration: parseInt(finalDuration) || 0,
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
      enableSectionTiming: enableSectionTiming !== undefined ? enableSectionTiming : false,
      enableSectionLocking: enableSectionLocking !== undefined ? enableSectionLocking : false,
      difficultyDistribution: difficultyDistribution || { easy: 0, medium: 0, hard: 0 },
      sections: processedSections,
      tags: tags || [],
      recurringSchedule: req.body.recurringSchedule || { enabled: false },
      createdBy: req.user._id
    });

    await exam.save();

    const populatedExam = await Exam.findById(exam._id)
      .populate('questions', 'questionText options marks questionImage language difficulty category subject topic translations tags bloomsTaxonomy');

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
    const { status, category, subCategory, tier, includeDeleted, page = 1, limit = 50 } = req.query;
    const query = {};

    // Hierarchical filtering: match exams at the selected level and below
    // If category is provided, it must match
    if (category && category !== 'none' && category !== '') {
      query.category = category;
    }

    // If subCategory is provided, it must match exactly
    if (subCategory && subCategory !== 'none' && subCategory !== '') {
      query.subCategory = subCategory;
    }

    // If tier is provided, it must match exactly
    // This ensures exams for a specific tier only show up when viewing that tier
    if (tier && tier !== 'none' && tier !== '') {
      query.tier = tier;
      // When querying by tier, we also need subCategory to match
      // This ensures we only get exams from the correct subCategory->tier combination
      if (subCategory && subCategory !== 'none' && subCategory !== '') {
        query.subCategory = subCategory;
      }
    }

    if (status) query.status = status;

    // Filter out soft-deleted exams by default
    // Include exams where deleted field doesn't exist (for backward compatibility)
    if (includeDeleted !== 'true') {
      query.$or = [
        { deleted: false },
        { deleted: { $exists: false } }
      ];
    }

    // Check if questions should be populated (default: false for performance)
    const includeQuestions = req.query.includeQuestions === 'true';

    // Check if we need minimal fields (for list view)
    const minimalFields = req.query.minimal === 'true';

    const examQuery = Exam.find(query)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name')
      .populate('deletedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // For minimal fields, only select what's needed for cards
    if (minimalFields) {
      examQuery.select('title duration totalMarks marksPerQuestion sections status scheduledTime deleted questions createdAt');
    }

    // Only populate questions if explicitly requested
    if (includeQuestions) {
      examQuery.populate('questions', 'questionText marks');
    } else if (!minimalFields) {
      // For non-minimal, get question count but don't populate
      // We'll add question count after query
    }

    const exams = await examQuery;

    // If minimal fields, add question count without populating
    if (minimalFields) {
      const examIds = exams.map(e => e._id);
      const examQuestionCounts = await Exam.find({ _id: { $in: examIds } })
        .select('_id questions')
        .lean();

      const questionCountMap = {};
      examQuestionCounts.forEach(exam => {
        questionCountMap[exam._id.toString()] = exam.questions?.length || 0;
      });

      // Add question count to each exam
      exams.forEach(exam => {
        exam.questions = questionCountMap[exam._id.toString()] || 0;
      });
    }

    const total = await Exam.countDocuments(query);

    res.json({
      exams,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeQuestions } = req.query;

    const examQuery = Exam.findById(id)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name');

    if (includeQuestions === 'true') {
      examQuery.populate('questions', 'questionText options marks questionImage language difficulty category subject topic explanation translations tags bloomsTaxonomy detailedSolution');
    }

    const exam = await examQuery;

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    res.json({ exam });
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
    if (req.body.subCategory !== undefined) exam.subCategory = req.body.subCategory || null;
    if (req.body.tier !== undefined) exam.tier = req.body.tier || null;
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
    if (req.body.enableSectionTiming !== undefined) exam.enableSectionTiming = req.body.enableSectionTiming;
    if (req.body.enableSectionLocking !== undefined) exam.enableSectionLocking = req.body.enableSectionLocking;
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
      .populate('questions', 'questionText options marks questionImage language difficulty category subject topic translations tags bloomsTaxonomy');

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
      .populate('questions', 'questionText options marks questionImage language difficulty category subject topic translations tags bloomsTaxonomy');

    res.json({ message: 'Exam published successfully', exam: populatedExam });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const duplicateExam = async (req, res) => {
  try {
    const originalExam = await Exam.findById(req.params.id);

    if (!originalExam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Create a new exam with copied data
    const duplicatedExam = new Exam({
      title: `${originalExam.title} (Copy)`,
      description: originalExam.description,
      category: originalExam.category,
      subCategory: originalExam.subCategory,
      tier: originalExam.tier,
      scheduledTime: null, // Reset scheduled time
      duration: originalExam.duration,
      questions: originalExam.questions,
      questionMarks: originalExam.questionMarks,
      totalMarks: originalExam.totalMarks,
      language: originalExam.language,
      status: 'draft', // Always start as draft
      allowReattempts: originalExam.allowReattempts,
      maxAttempts: originalExam.maxAttempts,
      allowTabSwitch: originalExam.allowTabSwitch,
      enableNegativeMarking: originalExam.enableNegativeMarking,
      negativeMarksPerQuestion: originalExam.negativeMarksPerQuestion,
      randomizeQuestions: originalExam.randomizeQuestions,
      timePerQuestion: originalExam.timePerQuestion,
      difficultyDistribution: originalExam.difficultyDistribution,
      sections: originalExam.sections ? JSON.parse(JSON.stringify(originalExam.sections)) : [],
      tags: originalExam.tags ? [...originalExam.tags] : [],
      isTemplate: false, // Don't duplicate template flag
      templateName: null,
      recurringSchedule: { enabled: false },
      createdBy: req.user._id
    });

    await duplicatedExam.save();

    const populatedExam = await Exam.findById(duplicatedExam._id)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('questions', 'questionText questionTextHindi options optionsHindi marks questionImage language difficulty category subject topic');

    res.json({ message: 'Exam duplicated successfully', exam: populatedExam });
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
      .select('title templateName category subCategory tier duration language marksPerQuestion randomizeQuestions timePerQuestion difficultyDistribution sections tags enableSectionTiming enableSectionLocking allowReattempts maxAttempts allowTabSwitch enableNegativeMarking negativeMarksPerQuestion createdAt')
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
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

// Get exam performance analytics (for existing exams)
export const getExamPerformanceAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    // Get all completed attempts for this exam
    const attempts = await ExamAttempt.find({
      exam: id,
      isCompleted: true
    })
      .populate('user', 'name email phoneNumber')
      .sort({ percentage: -1, createdAt: -1 })
      .lean();

    if (attempts.length === 0) {
      return res.json({
        totalAttempts: 0,
        completedAttempts: 0,
        averageScore: 0,
        averagePercentage: 0,
        highestScore: 0,
        highestPercentage: 0,
        topper: null,
        scoreDistribution: {},
        recentAttempts: []
      });
    }

    // Calculate statistics
    const totalAttempts = attempts.length;
    const totalScore = attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0);
    const totalPercentage = attempts.reduce((sum, a) => sum + (a.percentage || 0), 0);
    const averageScore = totalScore / totalAttempts;
    const averagePercentage = totalPercentage / totalAttempts;

    // Find topper (highest score)
    const topperAttempt = attempts[0]; // Already sorted by percentage desc
    const topper = topperAttempt.user ? {
      name: topperAttempt.user.name,
      email: topperAttempt.user.email,
      phoneNumber: topperAttempt.user.phoneNumber,
      score: topperAttempt.totalScore,
      percentage: topperAttempt.percentage,
      attemptDate: topperAttempt.endTime || topperAttempt.createdAt
    } : null;

    // Score distribution (by percentage ranges)
    const scoreDistribution = {
      '90-100': attempts.filter(a => a.percentage >= 90 && a.percentage <= 100).length,
      '80-89': attempts.filter(a => a.percentage >= 80 && a.percentage < 90).length,
      '70-79': attempts.filter(a => a.percentage >= 70 && a.percentage < 80).length,
      '60-69': attempts.filter(a => a.percentage >= 60 && a.percentage < 70).length,
      '50-59': attempts.filter(a => a.percentage >= 50 && a.percentage < 60).length,
      'Below 50': attempts.filter(a => a.percentage < 50).length
    };

    // Recent attempts (last 10)
    const recentAttempts = attempts.slice(0, 10).map(attempt => ({
      userName: attempt.user?.name || 'Unknown',
      score: attempt.totalScore,
      percentage: attempt.percentage,
      date: attempt.endTime || attempt.createdAt
    }));

    res.json({
      totalAttempts,
      completedAttempts: totalAttempts,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      highestScore: topperAttempt.totalScore,
      highestPercentage: topperAttempt.percentage,
      topper,
      scoreDistribution,
      recentAttempts
    });
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

