import Template from '../models/Template.js';

// Create a new template
export const createTemplate = async (req, res) => {
  try {
    const {
      templateName,
      description,
      category,
      subCategory,
      tier,
      duration,
      language = 'English',
      marksPerQuestion = 1,
      sections = [],
      tags = [],
      enableSectionTiming = false,
      enableSectionLocking = false,
      timePerQuestion = null,
      difficultyDistribution = { easy: 0, medium: 0, hard: 0 },
      allowReattempts = true,
      maxAttempts = 3,
      allowTabSwitch = false,
      enableNegativeMarking = false,
      negativeMarksPerQuestion = 0,
      randomizeQuestions = false
    } = req.body;

    // Validate language
    if (language && !['Hindi', 'English', 'Both'].includes(language)) {
      return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
    }

    // Validate template name
    if (!templateName || templateName.trim() === '') {
      return res.status(400).json({ message: 'Template name is required' });
    }

    // Process sections - ensure questionCount is set
    const processedSections = (sections || []).map((section, index) => ({
      name: section.name,
      description: section.description || '',
      questionCount: section.questionCount !== undefined && section.questionCount !== null
        ? parseInt(section.questionCount) || 0
        : 0,
      order: section.order !== undefined ? section.order : index,
      timeLimit: section.timeLimit ? parseInt(section.timeLimit) : null,
      marksPerQuestion: section.marksPerQuestion ? parseFloat(section.marksPerQuestion) : null,
      negativeMarking: section.negativeMarking ? parseFloat(section.negativeMarking) : 0,
      cutoff: section.cutoff ? parseFloat(section.cutoff) : null,
      isQualifying: section.isQualifying || false,
      isOptional: section.isOptional || false
    }));

    // For templates with section-wise timing, calculate duration from sections if not provided
    let finalDuration = duration;
    if (enableSectionTiming && processedSections.length > 0 && (!duration || duration === 0)) {
      finalDuration = processedSections.reduce((sum, section) => sum + (parseInt(section.timeLimit) || 0), 0);
    }
    // Ensure duration is set (use 0 for templates if not provided and no section timing)
    if (!finalDuration || finalDuration === 0) {
      finalDuration = 0; // Default to 0 for templates
    }

    const template = new Template({
      templateName: templateName.trim(),
      description: description || '',
      category,
      subCategory: subCategory || null,
      tier: tier || null,
      duration: parseInt(finalDuration) || 0,
      language: language || 'English',
      marksPerQuestion: parseFloat(marksPerQuestion) || 1,
      sections: processedSections,
      tags: tags || [],
      enableSectionTiming: enableSectionTiming !== undefined ? enableSectionTiming : false,
      enableSectionLocking: enableSectionLocking !== undefined ? enableSectionLocking : false,
      timePerQuestion: timePerQuestion ? parseInt(timePerQuestion) : null,
      difficultyDistribution: difficultyDistribution || { easy: 0, medium: 0, hard: 0 },
      allowReattempts: allowReattempts !== undefined ? allowReattempts : true,
      maxAttempts: maxAttempts || 3,
      allowTabSwitch: allowTabSwitch !== undefined ? allowTabSwitch : false,
      enableNegativeMarking: enableNegativeMarking || false,
      negativeMarksPerQuestion: enableNegativeMarking ? (parseFloat(negativeMarksPerQuestion) || 0) : 0,
      randomizeQuestions: randomizeQuestions || false,
      createdBy: req.user._id
    });

    await template.save();

    const populatedTemplate = await Template.findById(template._id)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name');

    res.status(201).json({
      message: 'Template created successfully',
      template: populatedTemplate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all templates
export const getTemplates = async (req, res) => {
  try {
    const { category, subCategory, tier } = req.query;
    const query = { deleted: { $ne: true } };

    // Filter by category hierarchy
    if (category && category !== 'none' && category !== '') {
      query.category = category;
    }
    if (subCategory && subCategory !== 'none' && subCategory !== '') {
      query.subCategory = subCategory;
    }
    if (tier && tier !== 'none' && tier !== '') {
      query.tier = tier;
      if (subCategory && subCategory !== 'none' && subCategory !== '') {
        query.subCategory = subCategory;
      }
    }

    const templates = await Template.find(query)
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

// Get template by ID
export const getTemplateById = async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    })
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name');

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update template
export const updateTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const {
      templateName,
      description,
      category,
      subCategory,
      tier,
      duration,
      language,
      marksPerQuestion,
      sections,
      tags,
      enableSectionTiming,
      enableSectionLocking,
      timePerQuestion,
      difficultyDistribution,
      allowReattempts,
      maxAttempts,
      allowTabSwitch,
      enableNegativeMarking,
      negativeMarksPerQuestion,
      randomizeQuestions
    } = req.body;

    // Update fields
    if (templateName !== undefined) template.templateName = templateName.trim();
    if (description !== undefined) template.description = description;
    if (category !== undefined) template.category = category;
    if (subCategory !== undefined) template.subCategory = subCategory || null;
    if (tier !== undefined) template.tier = tier || null;
    if (duration !== undefined) template.duration = parseInt(duration) || 0;
    if (language !== undefined) {
      if (!['Hindi', 'English', 'Both'].includes(language)) {
        return res.status(400).json({ message: 'Language must be Hindi, English, or Both' });
      }
      template.language = language;
    }
    if (marksPerQuestion !== undefined) template.marksPerQuestion = parseFloat(marksPerQuestion) || 1;
    if (sections !== undefined) {
      // Process sections similar to create
      template.sections = sections.map((section, index) => ({
        name: section.name,
        description: section.description || '',
        questionCount: section.questionCount !== undefined && section.questionCount !== null
          ? parseInt(section.questionCount) || 0
          : 0,
        order: section.order !== undefined ? section.order : index,
        timeLimit: section.timeLimit ? parseInt(section.timeLimit) : null,
        marksPerQuestion: section.marksPerQuestion ? parseFloat(section.marksPerQuestion) : null,
        negativeMarking: section.negativeMarking ? parseFloat(section.negativeMarking) : 0,
        cutoff: section.cutoff ? parseFloat(section.cutoff) : null,
        isQualifying: section.isQualifying || false,
        isOptional: section.isOptional || false
      }));
    }
    if (tags !== undefined) template.tags = tags;
    if (enableSectionTiming !== undefined) template.enableSectionTiming = enableSectionTiming;
    if (enableSectionLocking !== undefined) template.enableSectionLocking = enableSectionLocking;
    if (timePerQuestion !== undefined) template.timePerQuestion = timePerQuestion ? parseInt(timePerQuestion) : null;
    if (difficultyDistribution !== undefined) template.difficultyDistribution = difficultyDistribution;
    if (allowReattempts !== undefined) template.allowReattempts = allowReattempts;
    if (maxAttempts !== undefined) template.maxAttempts = maxAttempts;
    if (allowTabSwitch !== undefined) template.allowTabSwitch = allowTabSwitch;
    if (enableNegativeMarking !== undefined) template.enableNegativeMarking = enableNegativeMarking;
    if (negativeMarksPerQuestion !== undefined) {
      template.negativeMarksPerQuestion = enableNegativeMarking ? (parseFloat(negativeMarksPerQuestion) || 0) : 0;
    }
    if (randomizeQuestions !== undefined) template.randomizeQuestions = randomizeQuestions;

    await template.save();

    const populatedTemplate = await Template.findById(template._id)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name');

    res.json({
      message: 'Template updated successfully',
      template: populatedTemplate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete template (soft delete)
export const deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    template.deleted = true;
    template.deletedAt = new Date();
    template.deletedBy = req.user._id;
    await template.save();

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Restore template
export const restoreTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      deleted: true
    });

    if (!template) {
      return res.status(404).json({ message: 'Deleted template not found' });
    }

    template.deleted = false;
    template.deletedAt = null;
    template.deletedBy = null;
    await template.save();

    res.json({ message: 'Template restored successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Duplicate template
export const duplicateTemplate = async (req, res) => {
  try {
    const originalTemplate = await Template.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    });

    if (!originalTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const duplicatedTemplate = new Template({
      templateName: `${originalTemplate.templateName} (Copy)`,
      description: originalTemplate.description,
      category: originalTemplate.category,
      subCategory: originalTemplate.subCategory,
      tier: originalTemplate.tier,
      duration: originalTemplate.duration,
      language: originalTemplate.language,
      marksPerQuestion: originalTemplate.marksPerQuestion,
      sections: JSON.parse(JSON.stringify(originalTemplate.sections)),
      tags: [...(originalTemplate.tags || [])],
      enableSectionTiming: originalTemplate.enableSectionTiming,
      enableSectionLocking: originalTemplate.enableSectionLocking,
      timePerQuestion: originalTemplate.timePerQuestion,
      difficultyDistribution: originalTemplate.difficultyDistribution,
      allowReattempts: originalTemplate.allowReattempts,
      maxAttempts: originalTemplate.maxAttempts,
      allowTabSwitch: originalTemplate.allowTabSwitch,
      enableNegativeMarking: originalTemplate.enableNegativeMarking,
      negativeMarksPerQuestion: originalTemplate.negativeMarksPerQuestion,
      randomizeQuestions: originalTemplate.randomizeQuestions,
      createdBy: req.user._id
    });

    await duplicatedTemplate.save();

    const populatedTemplate = await Template.findById(duplicatedTemplate._id)
      .populate('category', 'name code')
      .populate('subCategory', 'name code')
      .populate('tier', 'name code')
      .populate('createdBy', 'name');

    res.json({
      message: 'Template duplicated successfully',
      template: populatedTemplate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

