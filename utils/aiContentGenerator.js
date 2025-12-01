import OpenAI from 'openai';

// Initialize OpenAI only when needed (lazy initialization)
let openai = null;

const getOpenAIClient = () => {
  if (!openai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or OPENAI_API_KEY environment variable is not set');
    }
    
    // Check if using Gemini (has baseURL) or OpenAI
    if (process.env.GEMINI_API_KEY) {
      openai = new OpenAI({
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.GEMINI_API_KEY,
      });
    } else {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }
  return openai;
};

export const generateWordOfDay = async () => {
  try {
    const client = getOpenAIClient();
    
    // Add variety by including different word categories and contexts
    const wordCategories = [
      'advanced vocabulary',
      'commonly confused words',
      'idiomatic expressions',
      'academic terminology',
      'business and economics terms',
      'scientific vocabulary',
      'literary words',
      'formal language',
      'phrasal verbs',
      'synonyms for common words'
    ];
    
    // Randomly select a category or use current date for variety
    const randomCategory = wordCategories[Math.floor(Math.random() * wordCategories.length)];
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    const prompt = `Generate a NEW and UNIQUE "Word of the Day" for ${currentDate} suitable for ALL types of government exam preparation.

EXAM TYPES TO CONSIDER:
- SSC (CGL, CHSL, MTS, GD, JE, Stenographer, etc.)
- Banking (IBPS PO, SBI PO, IBPS Clerk, RBI Grade B, etc.)
- Railway (RRB NTPC, RRB Group D, RPF, etc.)
- UPSC (Civil Services, CDS, NDA, etc.)
- State PSC (State-level civil services)
- Teaching (CTET, UGC NET, etc.)
- Defense (NDA, CDS, AFCAT, etc.)
- HSSC (Haryana State exams)
- Other competitive exams

IMPORTANT: Generate a DIFFERENT word each time. Do NOT repeat words like "Resilient" or common words. Choose from ${randomCategory} category.

The word should be:
- Useful for competitive exams across ALL government exam types
- NOT commonly used (avoid basic words like "good", "bad", "happy")
- Include pronunciation, meaning, example sentence, synonyms, antonyms
- Educational and inspiring
- Relevant to exam preparation (vocabulary, comprehension, English sections)
- Appropriate difficulty level for competitive exams (not too easy, not too obscure)

Return a JSON object with the following structure:
{
  "word": "the word (must be unique and different from previous words)",
  "pronunciation": "phonetic pronunciation in IPA or standard format",
  "meaning": "clear and detailed definition",
  "example": "example sentence using the word in context",
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "antonyms": ["antonym1", "antonym2"],
  "etymology": "brief origin/history if interesting",
  "usage": "brief usage note or tip"
}`;

    const completion = await client.chat.completions.create({
      model: process.env.GEMINI_API_KEY ? "gemini-2.0-flash" : "gpt-4o-mini",
      messages: [
        {
          role: 'system',
          content: 'You are an expert English teacher specializing in ALL types of government competitive exam preparation (SSC, Banking, Railway, UPSC, State PSC, Teaching, Defense, etc.). Generate UNIQUE, DIFFERENT educational words each time that are relevant across all exam types. Never repeat the same word. Always provide complete information in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9, // Increased from 0.7 to 0.9 for more variety
      max_tokens: 1000,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    return {
      word: parsed.word || '',
      pronunciation: parsed.pronunciation || '',
      meaning: parsed.meaning || '',
      example: parsed.example || '',
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : [],
      antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms : [],
      etymology: parsed.etymology || '',
      usage: parsed.usage || '',
      isAIGenerated: true
    };
  } catch (error) {
    console.error('Error generating word of the day:', error);
    throw new Error('Failed to generate word of the day: ' + error.message);
  }
};

export const generateMotivationalQuote = async (category = 'motivation') => {
  try {
    const client = getOpenAIClient();
    
    const categoryPrompts = {
      motivation: 'motivational and inspiring',
      success: 'about achieving success',
      perseverance: 'about persistence and never giving up',
      learning: 'about the importance of learning and education',
      exams: 'specifically about exam preparation and academic success',
      general: 'uplifting and positive'
    };
    
    const prompt = `Generate a ${categoryPrompts[category] || 'motivational'} quote suitable for students preparing for government exams. The quote should be:
- Inspiring and relevant to exam preparation
- Include an author (famous person, philosopher, or "Anonymous" if unknown)
- Short and impactful (1-2 sentences)
- Include a brief description explaining its relevance

Return a JSON object with the following structure:
{
  "quote": "the quote text",
  "author": "author name or 'Anonymous'",
  "category": "${category}",
  "description": "brief explanation of why this quote is relevant for exam preparation"
}`;

    const completion = await client.chat.completions.create({
      model: process.env.GEMINI_API_KEY ? "gemini-2.0-flash" : "gpt-4o-mini",
      messages: [
        {
          role: 'system',
          content: 'You are an expert in motivational content for students. Generate inspiring quotes with complete information in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 500,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    return {
      quote: parsed.quote || '',
      author: parsed.author || 'Anonymous',
      category: parsed.category || category,
      description: parsed.description || '',
      isAIGenerated: true
    };
  } catch (error) {
    console.error('Error generating motivational quote:', error);
    throw new Error('Failed to generate motivational quote: ' + error.message);
  }
};

