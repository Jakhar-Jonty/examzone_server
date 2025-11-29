import Subject from '../models/Subject.js';
import Topic from '../models/Topic.js';
import Question from '../models/Question.js';

// Get all subjects (global, not category-specific)
export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ isActive: true })
      .sort({ order: 1, name: 1 });
    res.json({ subjects });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single subject by ID
export const getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json({ subject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new subject (global)
export const createSubject = async (req, res) => {
  try {
    const { name, displayName, description, icon, color, order } = req.body;
    
    // Normalize name to uppercase for consistency
    const normalizedName = name.trim().toUpperCase();
    
    // Check if subject already exists
    const existing = await Subject.findOne({ name: normalizedName });
    if (existing) {
      return res.status(400).json({ message: 'Subject with this name already exists' });
    }

    const newSubject = new Subject({
      name: normalizedName,
      displayName: displayName || name,
      description,
      icon,
      color: color || '#3b82f6',
      order: order || 0,
      createdBy: req.user._id
    });

    await newSubject.save();
    res.status(201).json({ message: 'Subject created successfully', subject: newSubject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a subject
export const updateSubject = async (req, res) => {
  try {
    const { displayName, description, icon, color, order, isActive } = req.body;
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    if (displayName) subject.displayName = displayName;
    if (description !== undefined) subject.description = description;
    if (icon !== undefined) subject.icon = icon;
    if (color !== undefined) subject.color = color;
    if (order !== undefined) subject.order = order;
    if (isActive !== undefined) subject.isActive = isActive;

    await subject.save();
    res.json({ message: 'Subject updated successfully', subject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete subject (soft delete if in use)
export const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check if subject is in use
    const questionsCount = await Question.countDocuments({ 
      subject: { $regex: new RegExp(`^${subject.name}$`, 'i') } 
    });

    if (questionsCount > 0) {
      // Soft delete
      subject.isActive = false;
      await subject.save();
      res.json({ message: 'Subject deactivated successfully (in use)', subject });
    } else {
      await Subject.findByIdAndDelete(req.params.id);
      res.json({ message: 'Subject deleted successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get topics for a subject (optionally filtered by category)
export const getTopics = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { category, subCategory, tier } = req.query;

    if (!subjectId) {
      return res.status(400).json({ message: 'Subject ID is required' });
    }

    const query = { subject: subjectId };
    
    // If category filters provided, get category-specific topics
    // Otherwise, get global topics (category: null)
    if (category || subCategory || tier) {
      if (category) query.category = category;
      if (subCategory) query.subCategory = subCategory;
      if (tier) query.tier = tier;
    } else {
      // Get global topics (not category-specific)
      query.category = null;
      query.subCategory = null;
      query.tier = null;
    }

    const topics = await Topic.find(query)
      .populate('subject', 'name displayName')
      .sort({ usageCount: -1, lastUsed: -1 });

    res.json({ topics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a topic (can be global or category-specific)
export const createTopic = async (req, res) => {
  try {
    const { name, subjectId, category, subCategory, tier, subTopics } = req.body;

    if (!name || !subjectId) {
      return res.status(400).json({ message: 'Topic name and subject ID are required' });
    }

    const topic = new Topic({
      name: name.trim(),
      subject: subjectId,
      category: category || null,
      subCategory: subCategory || null,
      tier: tier || null,
      subTopics: subTopics || [],
      createdBy: req.user._id
    });

    await topic.save();
    
    // Update subject usage
    await Subject.findByIdAndUpdate(subjectId, {
      $inc: { usageCount: 1 },
      $set: { lastUsed: new Date() }
    });

    res.status(201).json({ message: 'Topic created successfully', topic });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Topic with this name already exists for this subject and category combination' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update a topic
export const updateTopic = async (req, res) => {
  try {
    const { name, subTopics } = req.body;
    const topic = await Topic.findById(req.params.id);

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    if (name) topic.name = name.trim();
    if (subTopics) topic.subTopics = subTopics;

    await topic.save();
    res.json({ message: 'Topic updated successfully', topic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a topic
export const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Check if topic is in use
    const questionsCount = await Question.countDocuments({ 
      topic: { $regex: new RegExp(`^${topic.name}$`, 'i') } 
    });

    if (questionsCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete topic: it is being used by questions',
        questionsCount 
      });
    }

    await Topic.findByIdAndDelete(req.params.id);
    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get subjects with their topics (for dropdowns)
export const getSubjectsWithTopics = async (req, res) => {
  try {
    const { category, subCategory, tier } = req.query;

    const subjects = await Subject.find({ isActive: true })
      .sort({ order: 1, name: 1 });

    const result = await Promise.all(
      subjects.map(async (subject) => {
        const topicQuery = { subject: subject._id };
        
        // Get both global topics (category: null) and category-specific topics
        if (category || subCategory || tier) {
          const categoryTopics = await Topic.find({
            subject: subject._id,
            category: category || null,
            subCategory: subCategory || null,
            tier: tier || null
          }).sort({ usageCount: -1 });

          const globalTopics = await Topic.find({
            subject: subject._id,
            category: null,
            subCategory: null,
            tier: null
          }).sort({ usageCount: -1 });

          // Combine and deduplicate
          const allTopics = [...categoryTopics, ...globalTopics];
          const uniqueTopics = Array.from(
            new Map(allTopics.map(t => [t.name, t])).values()
          );

          return {
            _id: subject._id,
            name: subject.name,
            displayName: subject.displayName,
            topics: uniqueTopics.map(t => ({
              _id: t._id,
              name: t.name,
              subTopics: t.subTopics
            }))
          };
        } else {
          // Get only global topics
          const topics = await Topic.find({
            subject: subject._id,
            category: null,
            subCategory: null,
            tier: null
          }).sort({ usageCount: -1 });

          return {
            _id: subject._id,
            name: subject.name,
            displayName: subject.displayName,
            topics: topics.map(t => ({
              _id: t._id,
              name: t.name,
              subTopics: t.subTopics
            }))
          };
        }
      })
    );

    res.json({ subjectsAndTopics: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

