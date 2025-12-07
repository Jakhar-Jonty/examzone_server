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

export const generateQuestions = async (categoryName, subject, topic, count, difficulty, language = 'English', subTopic = '', chapter = '') => {
  try {
    const { type, client } = getAIClient();
    
    let languageInstruction = '';
    if (language === 'Hindi') {
      languageInstruction = 'Generate all questions, options, and explanations in Hindi language only.';
    } else if (language === 'English') {
      languageInstruction = 'Generate all questions, options, and explanations in English language only.';
    } else if (language === 'Both') {
      languageInstruction = 'Generate each question with both English and Hindi versions. For each question, provide questionText (English), questionTextHindi (Hindi), options (English), optionsHindi (Hindi), explanation (English), and explanationHindi (Hindi).';
    }
    
    let topicText = '';
    if (topic) topicText += ` on the topic "${topic}"`;
    if (subTopic) topicText += `, specifically on the sub-topic "${subTopic}"`;
    if (chapter) topicText += ` from chapter/unit "${chapter}"`;
    
    const systemPrompt = 'You are an expert question generator for government exams. Generate high-quality multiple choice questions in the exact JSON format requested. Always return a JSON object with a "questions" key containing an array of questions.';
    
    const userPrompt = `Generate ${count} multiple choice questions for ${categoryName} exam on ${subject}${topicText} with ${difficulty} difficulty. ${languageInstruction}

Return a JSON object with a "questions" key containing an array with this exact structure:

${language === 'Both' ? `{
  "questions": [
    {
      "questionText": "...",
      "questionTextHindi": "...",
      "options": [
        {"optionLabel": "A", "optionText": "..."},
        {"optionLabel": "B", "optionText": "..."},
        {"optionLabel": "C", "optionText": "..."},
        {"optionLabel": "D", "optionText": "..."}
      ],
      "optionsHindi": [
        {"optionLabel": "A", "optionText": "..."},
        {"optionLabel": "B", "optionText": "..."},
        {"optionLabel": "C", "optionText": "..."},
        {"optionLabel": "D", "optionText": "..."}
      ],
      "correctAnswer": "A",
      "explanation": "...",
      "explanationHindi": "...",
      "subject": "${subject}",
      "marks": 1
    }
  ]
}` : `{
  "questions": [
    {
      "questionText": "...",
      "options": [
        {"optionLabel": "A", "optionText": "..."},
        {"optionLabel": "B", "optionText": "..."},
        {"optionLabel": "C", "optionText": "..."},
        {"optionLabel": "D", "optionText": "..."}
      ],
      "correctAnswer": "A",
      "explanation": "...",
      "subject": "${subject}",
      "topic": "${topic || ''}",
      "marks": 1
    }
  ]
}`}

Make sure each question has exactly 4 options labeled A, B, C, D. The correctAnswer must be one of these labels.`;

    let content;
    
    if (type === 'gemini') {
      // Use native Gemini SDK
      // Combine system and user prompts for Gemini
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 8000, // Increased to handle larger question sets
          responseMimeType: "application/json"
        }
      });
      
      // Get text content - try multiple possible response structures
      if (typeof response.text === 'string') {
        content = response.text;
      } else if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          const textPart = candidate.content.parts.find(part => part.text);
          content = textPart ? textPart.text : '';
        } else if (candidate.text) {
          content = candidate.text;
        }
      }
      
      if (!content || content.trim() === '') {
        console.error('Full Gemini response:', JSON.stringify(response, null, 2));
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
        temperature: 0.7,
        max_tokens: 4000,
      });
      content = completion.choices[0].message.content;
    }

    // Clean and parse JSON response
    let questions;
    
    // Helper function to repair incomplete JSON
    const repairJSON = (jsonString) => {
      // Remove markdown code blocks if present
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON object/array from text
      let jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = jsonString.match(/\[[\s\S]*\]/);
      }
      
      if (!jsonMatch) {
        // If no complete JSON found, try to find the start and complete it
        const startBrace = jsonString.indexOf('{');
        const startBracket = jsonString.indexOf('[');
        
        if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
          // JSON object - count braces to see if it's complete
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          
          for (let i = startBrace; i < jsonString.length; i++) {
            const char = jsonString[i];
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
            }
          }
          
          // If braces are not balanced, try to close them
          if (braceCount > 0) {
            // Find the last complete question object
            const lastCompleteQuestion = jsonString.lastIndexOf('}');
            if (lastCompleteQuestion !== -1) {
              // Extract up to the last complete question and close the structure
              let extracted = jsonString.substring(startBrace, lastCompleteQuestion + 1);
              // Close arrays and objects
              const openArrays = (extracted.match(/\[/g) || []).length;
              const closeArrays = (extracted.match(/\]/g) || []).length;
              const openBraces = (extracted.match(/\{/g) || []).length;
              const closeBraces = (extracted.match(/\}/g) || []).length;
              
              // Add missing closing brackets
              for (let i = 0; i < openArrays - closeArrays; i++) {
                extracted += ']';
              }
              for (let i = 0; i < openBraces - closeBraces; i++) {
                extracted += '}';
              }
              
              return extracted;
            }
          }
        }
      }
      
      return jsonMatch ? jsonMatch[0] : jsonString;
    };
    
    // Helper function to clean and fix JSON
    const cleanJSON = (jsonString) => {
      let cleaned = repairJSON(jsonString);
      
      // Fix common JSON issues
      cleaned = cleaned
        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
        .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Add quotes to unquoted keys (simple cases)
        .replace(/:\s*([^",\[\]{}\s][^",\[\]{}\n]*?)([,}\]])/g, (match, value, ending) => {
          // Add quotes to unquoted string values (but not numbers, booleans, null)
          if (!/^(true|false|null|\d+\.?\d*)$/.test(value.trim())) {
            return `: "${value}"${ending}`;
          }
          return match;
        });
      
      return cleaned;
    };
    
    try {
      // Clean the content first
      const cleanedContent = cleanJSON(content);
      const parsed = JSON.parse(cleanedContent);
      
      // Extract questions array from response
      if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
      } else if (Array.isArray(parsed)) {
        questions = parsed;
      } else {
        // Try to find questions in nested structure
        const keys = Object.keys(parsed);
        for (const key of keys) {
          if (Array.isArray(parsed[key])) {
            questions = parsed[key];
            break;
          }
        }
        if (!questions) {
          throw new Error('No questions array found in response structure');
        }
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Content length:', content.length);
      console.error('Content preview (first 1000 chars):', content.substring(0, 1000));
      console.error('Content preview (last 500 chars):', content.substring(Math.max(0, content.length - 500)));
      
      // Try multiple fallback strategies
      try {
        // Strategy 1: Extract JSON object
        const jsonObjectMatch = content.match(/\{[\s\S]*"questions"[\s\S]*\}/);
        if (jsonObjectMatch) {
          const cleaned = cleanJSON(jsonObjectMatch[0]);
          const parsed = JSON.parse(cleaned);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions;
          }
        }
        
        // Strategy 2: Extract JSON array directly
        if (!questions) {
          const jsonArrayMatch = content.match(/\[[\s\S]*\]/);
          if (jsonArrayMatch) {
            const cleaned = cleanJSON(jsonArrayMatch[0]);
            questions = JSON.parse(cleaned);
          }
        }
        
        // Strategy 3: Extract individual question objects from incomplete JSON
        if (!questions) {
          // Find all question objects even if JSON structure is broken
          const questionPattern = /\{[^}]*"questionText"\s*:\s*"[^"]*"[^}]*\}/g;
          const questionMatches = [];
          let match;
          
          // Use a more sophisticated regex to find complete question objects
          let braceCount = 0;
          let startPos = -1;
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < content.length; i++) {
            const char = content[i];
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
              if (char === '{') {
                if (braceCount === 0) {
                  startPos = i;
                }
                braceCount++;
              } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startPos !== -1) {
                  const questionJson = content.substring(startPos, i + 1);
                  // Check if it looks like a question object
                  if (questionJson.includes('"questionText"') || questionJson.includes('questionText')) {
                    questionMatches.push(questionJson);
                  }
                  startPos = -1;
                }
              }
            }
          }
          
          // Try to parse each question object
          if (questionMatches.length > 0) {
            const parsedQuestions = [];
            for (const questionJson of questionMatches) {
              try {
                const cleaned = cleanJSON(questionJson);
                const parsed = JSON.parse(cleaned);
                if (parsed.questionText) {
                  parsedQuestions.push(parsed);
                }
              } catch (e) {
                // Skip unparseable questions
                console.warn('Skipping unparseable question:', e.message);
              }
            }
            if (parsedQuestions.length > 0) {
              questions = parsedQuestions;
            }
          }
        }
        
        // Strategy 4: Try to fix common JSON issues on full content
        if (!questions) {
          let fixedContent = content
            .replace(/,\s*}/g, '}')  // Remove trailing commas before }
            .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Add quotes to unquoted keys
            .replace(/:\s*([^",\[\]{}\s]+)([,}\]])/g, ': "$1"$2');  // Add quotes to unquoted string values
          
          const cleaned = cleanJSON(fixedContent);
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.questions && Array.isArray(parsed.questions)) {
              questions = parsed.questions;
            } else if (Array.isArray(parsed)) {
              questions = parsed;
            }
          } catch (e) {
            // Last attempt failed
          }
        }
        
        if (!questions) {
          throw new Error(`Failed to parse JSON. Original error: ${parseError.message}. Content length: ${content.length}`);
        }
      } catch (fallbackError) {
        console.error('All JSON parsing strategies failed:', fallbackError);
        throw new Error(`Failed to parse AI response as JSON. Please check the API response format. Error: ${parseError.message}`);
      }
    }

    // Validate structure
    const validatedQuestions = questions.map((q, index) => {
      if (!q.questionText || !q.options || !q.correctAnswer || !q.explanation) {
        throw new Error(`Question ${index + 1} is missing required fields`);
      }
      if (q.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly 4 options`);
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
        throw new Error(`Question ${index + 1} has invalid correctAnswer`);
      }
    
      const questionData = {
        questionText: q.questionText,
        options: q.options.map(opt => ({
          optionText: opt.optionText,
          optionLabel: opt.optionLabel
        })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject || subject,
        topic: q.topic || topic || '',
        subTopic: subTopic || '',
        chapter: chapter || '',
        marks: q.marks || 1,
        difficulty: difficulty,
        language: language,
        questionType: 'MCQ' // AI generator only creates MCQ questions
      };

      // Add Hindi fields if language is Both or Hindi
      if (language === 'Both' || language === 'Hindi') {
        if (q.questionTextHindi) questionData.questionTextHindi = q.questionTextHindi;
        if (q.optionsHindi) {
          questionData.optionsHindi = q.optionsHindi.map(opt => ({
            optionText: opt.optionText,
            optionLabel: opt.optionLabel
          }));
        }
        if (q.explanationHindi) questionData.explanationHindi = q.explanationHindi;
      }

      return questionData;
    });

    return validatedQuestions;
  } catch (error) {
    console.error('AI Generation Error:', error);
    
    // Handle rate limit errors specifically
    if (error.status === 429 || error.statusCode === 429) {
      throw new Error('API rate limit exceeded. Please try again later or check your API quota.');
    }
    
    throw new Error(`Failed to generate questions: ${error.message}`);
  }
};
