import Article from '../models/Article.js';
import User from '../models/User.js';

// Admin routes
export const createArticle = async (req, res) => {
  try {
    const { title, content, category, status, isPremium } = req.body;
    
    // Parse subjects array from FormData
    let subjects = [];
    if (req.body.subjects) {
      if (Array.isArray(req.body.subjects)) {
        subjects = req.body.subjects;
      } else if (typeof req.body.subjects === 'string') {
        // Handle single subject or comma-separated
        subjects = req.body.subjects.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    
    // Handle subjects[] array format from FormData
    if (req.body['subjects[]']) {
      if (Array.isArray(req.body['subjects[]'])) {
        subjects = req.body['subjects[]'];
      } else {
        subjects = [req.body['subjects[]']];
      }
    }

    // Parse isPremium - handle various formats
    let isPremiumValue = false;
    if (isPremium !== undefined && isPremium !== null) {
      if (typeof isPremium === 'boolean') {
        isPremiumValue = isPremium;
      } else if (typeof isPremium === 'string') {
        isPremiumValue = isPremium === 'true' || isPremium === '1' || isPremium === 'on';
      } else if (typeof isPremium === 'object') {
        // If it's an object (like {}), treat as false
        isPremiumValue = false;
      }
    }

    const articleData = {
      title,
      content,
      category,
      subjects: subjects.length > 0 ? subjects : [],
      status: status || 'draft',
      isPremium: isPremiumValue,
      createdBy: req.user._id
    };

    if (req.files?.thumbnail && req.files.thumbnail[0]) {
      articleData.thumbnail = req.files.thumbnail[0].path;
    }
    if (req.files?.docxFile && req.files.docxFile[0]) {
      articleData.docxFile = req.files.docxFile[0].path;
    }

    console.log('Creating article with data:', articleData);

    const article = new Article(articleData);
    await article.save();

    res.status(201).json({ message: 'Article created successfully', article });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAdminArticles = async (req, res) => {
  try {
    const { status, category } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;

    const articles = await Article.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ articles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    const { title, content, category, status, isPremium } = req.body;
    
    // Parse subjects array from FormData
    let subjects = article.subjects || [];
    if (req.body.subjects) {
      if (Array.isArray(req.body.subjects)) {
        subjects = req.body.subjects;
      } else if (typeof req.body.subjects === 'string') {
        subjects = req.body.subjects.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    
    // Handle subjects[] array format from FormData
    if (req.body['subjects[]']) {
      if (Array.isArray(req.body['subjects[]'])) {
        subjects = req.body['subjects[]'];
      } else {
        subjects = [req.body['subjects[]']];
      }
    }

    // Update article fields
    if (title) article.title = title;
    if (content) article.content = content;
    if (category) article.category = category;
    if (status) article.status = status;
    if (isPremium !== undefined && isPremium !== null) {
      // Parse isPremium - handle various formats
      if (typeof isPremium === 'boolean') {
        article.isPremium = isPremium;
      } else if (typeof isPremium === 'string') {
        article.isPremium = isPremium === 'true' || isPremium === '1' || isPremium === 'on';
      } else if (typeof isPremium === 'object') {
        // If it's an object (like {}), treat as false
        article.isPremium = false;
      } else {
        article.isPremium = false;
      }
    }
    if (subjects.length > 0) article.subjects = subjects;

    if (req.files?.thumbnail && req.files.thumbnail[0]) {
      article.thumbnail = req.files.thumbnail[0].path;
    }
    if (req.files?.docxFile && req.files.docxFile[0]) {
      article.docxFile = req.files.docxFile[0].path;
    }

    await article.save();

    res.json({ message: 'Article updated successfully', article });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    await article.deleteOne();

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Public routes
export const getArticles = async (req, res) => {
  try {
    const { category, subject, search, page = 1, limit = 20 } = req.query;
    const query = { status: 'published' };

    if (category) query.category = category;
    if (subject) query.subjects = { $in: [subject] };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Check user subscription for premium filter
    let user = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.userId);
      } catch (e) {
        // Invalid token, treat as guest
      }
    }

    // If user is not premium, filter out premium articles
    if (!user || user.subscriptionStatus !== 'premium') {
      query.isPremium = false;
    }

    const articles = await Article.find(query)
      .select('title category subjects thumbnail isPremium createdAt docxFile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Article.countDocuments(query);

    res.json({
      articles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    if (article.status !== 'published') {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check premium access
    let user = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.userId);
      } catch (e) {
        // Invalid token
      }
    }

    if (article.isPremium && (!user || user.subscriptionStatus !== 'premium')) {
      return res.status(403).json({ 
        message: 'Premium subscription required to access this article' 
      });
    }

    res.json({ article });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const searchArticles = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const articles = await Article.find({
      status: 'published',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
        { subjects: { $in: [new RegExp(q, 'i')] } }
      ]
    })
    .select('title category subjects thumbnail isPremium createdAt')
    .limit(20);

    res.json({ articles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

