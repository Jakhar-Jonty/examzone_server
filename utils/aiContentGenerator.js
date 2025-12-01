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
    
    const prompt = `Generate a "Word of the Day" suitable for government exam preparation (SSC, Banking, HSSC). The word should be:
- Useful for competitive exams
- Include pronunciation, meaning, example sentence, synonyms, antonyms
- Educational and inspiring

Return a JSON object with the following structure:
{
  "word": "the word",
  "pronunciation": "phonetic pronunciation",
  "meaning": "clear definition",
  "example": "example sentence using the word",
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "antonyms": ["antonym1", "antonym2"],
  "etymology": "brief origin/history if interesting",
  "usage": "brief usage note"
}`;

    const completion = await client.chat.completions.create({
      model: process.env.GEMINI_API_KEY ? "gemini-2.0-flash" : "gpt-4o-mini",
      messages: [
        {
          role: 'system',
          content: 'You are an expert English teacher specializing in competitive exam preparation. Generate educational and useful words with complete information in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
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

