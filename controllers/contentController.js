import WordOfDay from '../models/WordOfDay.js';
import MotivationalQuote from '../models/MotivationalQuote.js';
import { generateWordOfDay, generateMotivationalQuote } from '../utils/aiContentGenerator.js';
import mongoose from 'mongoose';

// ==================== WORD OF THE DAY ====================

export const createWordOfDay = async (req, res) => {
  try {
    const {
      word, pronunciation, meaning, example, synonyms, antonyms,
      etymology, usage, scheduledDate, status = 'draft'
    } = req.body;

    if (!word || !meaning || !scheduledDate) {
      return res.status(400).json({ 
        message: 'word, meaning, and scheduledDate are required' 
      });
    }

    // Check if word already exists for the same date
    const existing = await WordOfDay.findOne({ 
      scheduledDate: new Date(scheduledDate),
      status: { $in: ['scheduled', 'published'] }
    });

    if (existing) {
      return res.status(400).json({ 
        message: 'A word is already scheduled for this date' 
      });
    }

    const wordOfDay = new WordOfDay({
      word,
      pronunciation,
      meaning,
      example,
      synonyms: Array.isArray(synonyms) ? synonyms : [],
      antonyms: Array.isArray(antonyms) ? antonyms : [],
      etymology,
      usage,
      scheduledDate: new Date(scheduledDate),
      status,
      createdBy: req.user._id
    });

    await wordOfDay.save();
    res.status(201).json({ message: 'Word of the day created successfully', wordOfDay });
  } catch (error) {
    console.error('Error creating word of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

export const generateAIWordOfDay = async (req, res) => {
  try {
    const generated = await generateWordOfDay();
    res.json({ 
      message: 'Word of the day generated successfully',
      wordOfDay: generated
    });
  } catch (error) {
    console.error('Error generating AI word of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getWordsOfDay = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) {
        query.scheduledDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.scheduledDate.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { word: { $regex: search, $options: 'i' } },
        { meaning: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await WordOfDay.countDocuments(query);
    const words = await WordOfDay.find(query)
      .populate('createdBy', 'name')
      .sort({ scheduledDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      words,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching words of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getWordOfDayById = async (req, res) => {
  try {
    const word = await WordOfDay.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!word) {
      return res.status(404).json({ message: 'Word of the day not found' });
    }

    res.json({ word });
  } catch (error) {
    console.error('Error fetching word of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateWordOfDay = async (req, res) => {
  try {
    const {
      word, pronunciation, meaning, example, synonyms, antonyms,
      etymology, usage, scheduledDate, status
    } = req.body;

    const wordOfDay = await WordOfDay.findById(req.params.id);
    
    if (!wordOfDay) {
      return res.status(404).json({ message: 'Word of the day not found' });
    }

    // Check if date change conflicts with existing word
    if (scheduledDate && new Date(scheduledDate).toDateString() !== wordOfDay.scheduledDate.toDateString()) {
      const existing = await WordOfDay.findOne({ 
        scheduledDate: new Date(scheduledDate),
        status: { $in: ['scheduled', 'published'] },
        _id: { $ne: req.params.id }
      });

      if (existing) {
        return res.status(400).json({ 
          message: 'A word is already scheduled for this date' 
        });
      }
    }

    if (word) wordOfDay.word = word;
    if (pronunciation !== undefined) wordOfDay.pronunciation = pronunciation;
    if (meaning) wordOfDay.meaning = meaning;
    if (example !== undefined) wordOfDay.example = example;
    if (synonyms !== undefined) wordOfDay.synonyms = Array.isArray(synonyms) ? synonyms : [];
    if (antonyms !== undefined) wordOfDay.antonyms = Array.isArray(antonyms) ? antonyms : [];
    if (etymology !== undefined) wordOfDay.etymology = etymology;
    if (usage !== undefined) wordOfDay.usage = usage;
    if (scheduledDate) wordOfDay.scheduledDate = new Date(scheduledDate);
    if (status) wordOfDay.status = status;

    await wordOfDay.save();
    res.json({ message: 'Word of the day updated successfully', wordOfDay });
  } catch (error) {
    console.error('Error updating word of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteWordOfDay = async (req, res) => {
  try {
    const word = await WordOfDay.findById(req.params.id);
    
    if (!word) {
      return res.status(404).json({ message: 'Word of the day not found' });
    }

    await WordOfDay.findByIdAndDelete(req.params.id);
    res.json({ message: 'Word of the day deleted successfully' });
  } catch (error) {
    console.error('Error deleting word of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCurrentWordOfDay = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const word = await WordOfDay.findOne({
      scheduledDate: { $gte: today, $lt: tomorrow },
      status: 'published'
    }).populate('createdBy', 'name');

    if (!word) {
      return res.status(404).json({ message: 'No word of the day available' });
    }

    res.json({ wordOfDay: word });
  } catch (error) {
    console.error('Error fetching current word of the day:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== MOTIVATIONAL QUOTE ====================

export const createMotivationalQuote = async (req, res) => {
  try {
    const {
      quote, author, category, description, scheduledDate, status = 'draft'
    } = req.body;

    if (!quote || !scheduledDate) {
      return res.status(400).json({ 
        message: 'quote and scheduledDate are required' 
      });
    }

    // Check if quote already exists for the same date
    const existing = await MotivationalQuote.findOne({ 
      scheduledDate: new Date(scheduledDate),
      status: { $in: ['scheduled', 'published'] }
    });

    if (existing) {
      return res.status(400).json({ 
        message: 'A quote is already scheduled for this date' 
      });
    }

    const motivationalQuote = new MotivationalQuote({
      quote,
      author: author || 'Anonymous',
      category: category || 'motivation',
      description,
      scheduledDate: new Date(scheduledDate),
      status,
      createdBy: req.user._id
    });

    await motivationalQuote.save();
    res.status(201).json({ message: 'Motivational quote created successfully', quote: motivationalQuote });
  } catch (error) {
    console.error('Error creating motivational quote:', error);
    res.status(500).json({ message: error.message });
  }
};

export const generateAIMotivationalQuote = async (req, res) => {
  try {
    const { category = 'motivation' } = req.body;
    const generated = await generateMotivationalQuote(category);
    res.json({ 
      message: 'Motivational quote generated successfully',
      quote: generated
    });
  } catch (error) {
    console.error('Error generating AI motivational quote:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMotivationalQuotes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      category,
      startDate, 
      endDate,
      search 
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) {
        query.scheduledDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.scheduledDate.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { quote: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await MotivationalQuote.countDocuments(query);
    const quotes = await MotivationalQuote.find(query)
      .populate('createdBy', 'name')
      .sort({ scheduledDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      quotes,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching motivational quotes:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMotivationalQuoteById = async (req, res) => {
  try {
    const quote = await MotivationalQuote.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!quote) {
      return res.status(404).json({ message: 'Motivational quote not found' });
    }

    res.json({ quote });
  } catch (error) {
    console.error('Error fetching motivational quote:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateMotivationalQuote = async (req, res) => {
  try {
    const {
      quote, author, category, description, scheduledDate, status
    } = req.body;

    const motivationalQuote = await MotivationalQuote.findById(req.params.id);
    
    if (!motivationalQuote) {
      return res.status(404).json({ message: 'Motivational quote not found' });
    }

    // Check if date change conflicts with existing quote
    if (scheduledDate && new Date(scheduledDate).toDateString() !== motivationalQuote.scheduledDate.toDateString()) {
      const existing = await MotivationalQuote.findOne({ 
        scheduledDate: new Date(scheduledDate),
        status: { $in: ['scheduled', 'published'] },
        _id: { $ne: req.params.id }
      });

      if (existing) {
        return res.status(400).json({ 
          message: 'A quote is already scheduled for this date' 
        });
      }
    }

    if (quote) motivationalQuote.quote = quote;
    if (author !== undefined) motivationalQuote.author = author;
    if (category) motivationalQuote.category = category;
    if (description !== undefined) motivationalQuote.description = description;
    if (scheduledDate) motivationalQuote.scheduledDate = new Date(scheduledDate);
    if (status) motivationalQuote.status = status;

    await motivationalQuote.save();
    res.json({ message: 'Motivational quote updated successfully', quote: motivationalQuote });
  } catch (error) {
    console.error('Error updating motivational quote:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteMotivationalQuote = async (req, res) => {
  try {
    const quote = await MotivationalQuote.findById(req.params.id);
    
    if (!quote) {
      return res.status(404).json({ message: 'Motivational quote not found' });
    }

    await MotivationalQuote.findByIdAndDelete(req.params.id);
    res.json({ message: 'Motivational quote deleted successfully' });
  } catch (error) {
    console.error('Error deleting motivational quote:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCurrentMotivationalQuote = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const quote = await MotivationalQuote.findOne({
      scheduledDate: { $gte: today, $lt: tomorrow },
      status: 'published'
    }).populate('createdBy', 'name');

    if (!quote) {
      return res.status(404).json({ message: 'No motivational quote available' });
    }

    res.json({ motivationalQuote: quote });
  } catch (error) {
    console.error('Error fetching current motivational quote:', error);
    res.status(500).json({ message: error.message });
  }
};

