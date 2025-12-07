import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

// Initialize clients only when needed (lazy initialization)
let openai = null;
let gemini = null;

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or OPENAI_API_KEY environment variable is not set');
  }
  
  // Use native Gemini SDK if GEMINI_API_KEY is present
  if (process.env.GEMINI_API_KEY) {
    if (!gemini) {
      gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return { type: 'gemini', client: gemini };
  } else {
    // Use OpenAI SDK
    if (!openai) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return { type: 'openai', client: openai };
  }
};

export const generateWordOfDay = async () => {
  try {
    const { type, client } = getAIClient();
    
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
    
    const systemPrompt = 'You are an expert English teacher specializing in ALL types of government competitive exam preparation (SSC, Banking, Railway, UPSC, State PSC, Teaching, Defense, etc.). Generate UNIQUE, DIFFERENT educational words each time that are relevant across all exam types. Never repeat the same word. Always provide complete information in JSON format.';
    
    const userPrompt = `Generate a NEW and UNIQUE "Word of the Day" for ${currentDate} suitable for ALL types of government exam preparation.

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

    let content;
    
    if (type === 'gemini') {
      // Use native Gemini SDK
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      let response;
      try {
        response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fullPrompt,
          config: {
            temperature: 0.9,
            maxOutputTokens: 2000, // Increased to prevent truncation
            responseMimeType: "application/json"
          }
        });
      } catch (apiError) {
        console.error('Gemini API Error:', apiError);
        throw new Error(`Gemini API call failed: ${apiError.message}`);
      }
      
      // Get text content - use same pattern as aiQuestionGenerator.js
      if (typeof response.text === 'string') {
        content = response.text;
      } else if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        // Check for finishReason
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.warn('Gemini response was truncated due to MAX_TOKENS. Consider increasing maxOutputTokens.');
        }
        
        // Try to get text from parts array - use same pattern as aiQuestionGenerator.js
        if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
          // Find text part or concatenate all text parts
          const textParts = candidate.content.parts.filter(part => part.text).map(part => part.text);
          content = textParts.join('');
        } else if (candidate.text) {
          content = candidate.text;
        } else if (candidate.content && typeof candidate.content === 'string') {
          content = candidate.content;
        }
      }
      
      if (!content || content.trim() === '') {
        console.error('Full Gemini response:', JSON.stringify(response, null, 2));
        // Check if it's a MAX_TOKENS issue
        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
          throw new Error('Gemini API response was truncated (MAX_TOKENS). The response exceeded the token limit. Try reducing the prompt length or increasing maxOutputTokens.');
        }
        throw new Error('No content received from Gemini API. Response structure may have changed.');
      }
    } else {
      // Use OpenAI SDK
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        max_tokens: 1000,
      });
      content = completion.choices[0].message.content;
    }

    // Helper function to repair incomplete JSON
    const repairIncompleteJSON = (jsonString) => {
      // Remove markdown code blocks
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Find the JSON object start
      const startBrace = jsonString.indexOf('{');
      if (startBrace === -1) return jsonString;
      
      let json = jsonString.substring(startBrace);
      
      // Track string state and find the last valid position
      let inString = false;
      let escapeNext = false;
      let lastValidPos = json.length - 1;
      
      for (let i = 0; i < json.length; i++) {
        const char = json[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          if (!inString) {
            lastValidPos = i;
          }
        } else if (!inString) {
          lastValidPos = i;
        }
      }
      
      // If we're in a string at the end, find the last complete field
      if (inString) {
        // Find the last complete field (ending with } or ] or ,)
        let cutPos = lastValidPos + 1;
        
        // Look backwards for the last complete structure
        for (let i = lastValidPos; i >= 0; i--) {
          const char = json[i];
          if (char === '}' || char === ']' || (char === ',' && i < lastValidPos)) {
            cutPos = i + 1;
            break;
          }
        }
        
        // If we found a comma, include it; if we found }, include it
        if (cutPos > 0) {
          json = json.substring(0, cutPos);
          // Remove trailing comma if present
          json = json.replace(/,\s*$/, '');
        } else {
          // Fallback: just use up to last valid position
          json = json.substring(0, lastValidPos + 1);
        }
      }
      
      // Count braces and brackets to close them properly
      let braceCount = 0;
      let bracketCount = 0;
      inString = false;
      escapeNext = false;
      
      for (let i = 0; i < json.length; i++) {
        const char = json[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          if (char === '[') bracketCount++;
          if (char === ']') bracketCount--;
        }
      }
      
      // Remove trailing comma before closing
      json = json.replace(/,\s*$/, '');
      
      // Close incomplete structures
      for (let i = 0; i < bracketCount; i++) {
        json += ']';
      }
      for (let i = 0; i < braceCount; i++) {
        json += '}';
      }
      
      return json;
    };
    
    // Clean JSON content
    const cleanJSON = (jsonString) => {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = jsonString.match(/\{[\s\S]*/);
      return jsonMatch ? jsonMatch[0] : jsonString;
    };
    
    let parsed;
    try {
      const cleaned = cleanJSON(content);
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON Parse Error for Word of Day:', parseError.message);
      console.error('Content preview:', content.substring(0, 1000));
      console.error('Content length:', content.length);
      
      try {
        // Try to repair incomplete JSON
        const repaired = repairIncompleteJSON(content);
        parsed = JSON.parse(repaired);
        console.log('Successfully repaired incomplete JSON');
      } catch (repairError) {
        console.error('JSON repair failed:', repairError.message);
        // Try to fix common JSON issues
        let fixedContent = content
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
          .replace(/:\s*([^",\[\]{}\s]+)([,}\]])/g, ': "$1"$2');
        
        try {
          const repaired = repairIncompleteJSON(fixedContent);
          parsed = JSON.parse(repaired);
        } catch (finalError) {
          throw new Error(`Failed to parse JSON: ${parseError.message}. Repair attempts also failed.`);
        }
      }
    }
    
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
    
    // Handle rate limit errors specifically
    if (error.status === 429 || error.statusCode === 429) {
      throw new Error('API rate limit exceeded. Please try again later or check your API quota.');
    }
    
    throw new Error('Failed to generate word of the day: ' + (error.message || 'Unknown error'));
  }
};

export const generateMotivationalQuote = async (category = 'motivation') => {
  try {
    const { type, client } = getAIClient();
    
    const categoryPrompts = {
      motivation: 'motivational and inspiring',
      success: 'about achieving success',
      perseverance: 'about persistence and never giving up',
      learning: 'about the importance of learning and education',
      exams: 'specifically about exam preparation and academic success',
      general: 'uplifting and positive'
    };
    
    const systemPrompt = 'You are an expert in motivational content for students. Generate inspiring quotes with complete information in JSON format.';
    
    const userPrompt = `Generate a ${categoryPrompts[category] || 'motivational'} quote suitable for students preparing for government exams. The quote should be:
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

    let content;
    
    if (type === 'gemini') {
      // Use native Gemini SDK
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      let response;
      try {
        response = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fullPrompt,
          config: {
            temperature: 0.8,
            maxOutputTokens: 1000, // Increased to prevent truncation
            responseMimeType: "application/json"
          }
        });
      } catch (apiError) {
        console.error('Gemini API Error:', apiError);
        throw new Error(`Gemini API call failed: ${apiError.message}`);
      }
      
      // Get text content - use same pattern as aiQuestionGenerator.js
      if (typeof response.text === 'string') {
        content = response.text;
      } else if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        // Check for finishReason
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.warn('Gemini response was truncated due to MAX_TOKENS. Consider increasing maxOutputTokens.');
        }
        
        // Try to get text from parts array - use same pattern as aiQuestionGenerator.js
        if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
          // Find text part or concatenate all text parts
          const textParts = candidate.content.parts.filter(part => part.text).map(part => part.text);
          content = textParts.join('');
        } else if (candidate.text) {
          content = candidate.text;
        } else if (candidate.content && typeof candidate.content === 'string') {
          content = candidate.content;
        }
      }
      
      if (!content || content.trim() === '') {
        console.error('Full Gemini response:', JSON.stringify(response, null, 2));
        // Check if it's a MAX_TOKENS issue
        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
          throw new Error('Gemini API response was truncated (MAX_TOKENS). The response exceeded the token limit. Try reducing the prompt length or increasing maxOutputTokens.');
        }
        throw new Error('No content received from Gemini API. Response structure may have changed.');
      }
    } else {
      // Use OpenAI SDK
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 500,
      });
      content = completion.choices[0].message.content;
    }

    // Use the same repair function as word of day
    const repairIncompleteJSON = (jsonString) => {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const startBrace = jsonString.indexOf('{');
      if (startBrace === -1) return jsonString;
      
      let json = jsonString.substring(startBrace);
      
      let inString = false;
      let escapeNext = false;
      let lastValidPos = json.length - 1;
      
      for (let i = 0; i < json.length; i++) {
        const char = json[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          if (!inString) {
            lastValidPos = i;
          }
        } else if (!inString) {
          lastValidPos = i;
        }
      }
      
      if (inString) {
        let cutPos = lastValidPos + 1;
        for (let i = lastValidPos; i >= 0; i--) {
          const char = json[i];
          if (char === '}' || char === ']' || (char === ',' && i < lastValidPos)) {
            cutPos = i + 1;
            break;
          }
        }
        if (cutPos > 0) {
          json = json.substring(0, cutPos);
          json = json.replace(/,\s*$/, '');
        } else {
          json = json.substring(0, lastValidPos + 1);
        }
      }
      
      let braceCount = 0;
      let bracketCount = 0;
      inString = false;
      escapeNext = false;
      
      for (let i = 0; i < json.length; i++) {
        const char = json[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          if (char === '[') bracketCount++;
          if (char === ']') bracketCount--;
        }
      }
      
      json = json.replace(/,\s*$/, '');
      for (let i = 0; i < bracketCount; i++) {
        json += ']';
      }
      for (let i = 0; i < braceCount; i++) {
        json += '}';
      }
      
      return json;
    };
    
    const cleanJSON = (jsonString) => {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = jsonString.match(/\{[\s\S]*/);
      return jsonMatch ? jsonMatch[0] : jsonString;
    };
    
    let parsed;
    try {
      const cleaned = cleanJSON(content);
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON Parse Error for Quote:', parseError.message);
      console.error('Content preview:', content.substring(0, 1000));
      console.error('Content length:', content.length);
      
      try {
        const repaired = repairIncompleteJSON(content);
        parsed = JSON.parse(repaired);
        console.log('Successfully repaired incomplete JSON for quote');
      } catch (repairError) {
        console.error('JSON repair failed:', repairError.message);
        let fixedContent = content
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
          .replace(/:\s*([^",\[\]{}\s]+)([,}\]])/g, ': "$1"$2');
        
        try {
          const repaired = repairIncompleteJSON(fixedContent);
          parsed = JSON.parse(repaired);
        } catch (finalError) {
          throw new Error(`Failed to parse JSON: ${parseError.message}. Repair attempts also failed.`);
        }
      }
    }
    
    return {
      quote: parsed.quote || '',
      author: parsed.author || 'Anonymous',
      category: parsed.category || category,
      description: parsed.description || '',
      isAIGenerated: true
    };
  } catch (error) {
    console.error('Error generating motivational quote:', error);
    
    // Handle rate limit errors specifically
    if (error.status === 429 || error.statusCode === 429) {
      throw new Error('API rate limit exceeded. Please try again later or check your API quota.');
    }
    
    throw new Error('Failed to generate motivational quote: ' + (error.message || 'Unknown error'));
  }
};
