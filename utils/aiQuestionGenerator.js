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
    if (!openai) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return { type: 'openai', client: openai };
  }
};

// ============================================================
// TRANSLATE QUESTION CONTENT (English <-> Hindi using AI)
// ============================================================
export const translateQuestionContent = async (content, fromLanguage, toLanguage) => {
  try {
    const { type, client } = getAIClient();

    const systemPrompt = `You are an expert translator for educational exam content. Translate the provided question content from ${fromLanguage} to ${toLanguage}. Preserve the meaning, technical terminology, and formatting. Return a JSON object with exactly the same structure as the input.`;

    const userPrompt = `Translate this exam question content from ${fromLanguage} to ${toLanguage}. Return a JSON object with these fields (translate all text values, keep optionLabel values unchanged):

Input content:
${JSON.stringify(content, null, 2)}

Return a JSON object with the same structure but all text translated to ${toLanguage}.`;

    let responseContent;

    if (type === 'gemini') {
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json'
        }
      });

      if (typeof response.text === 'string') {
        responseContent = response.text;
      } else if (response.candidates?.[0]?.content?.parts) {
        const textPart = response.candidates[0].content.parts.find(p => p.text);
        responseContent = textPart ? textPart.text : '';
      }
    } else {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      });
      responseContent = completion.choices[0].message.content;
    }

    // Parse and return
    const cleaned = responseContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Translation failed: ${error.message}`);
  }
};

// ============================================================
// GENERATE QUESTIONS (MCQ with metadata + translations)
// ============================================================
export const generateQuestions = async (categoryName, subject, topic, count, difficulty, language = 'English', subTopic = '', chapter = '', questionType = 'MCQ', bloomsTaxonomy = '') => {
  try {
    const { type, client } = getAIClient();

    let languageInstruction = '';
    if (language === 'Hindi') {
      languageInstruction = 'Generate all questions, options, and explanations in Hindi language only.';
    } else if (language === 'English') {
      languageInstruction = 'Generate all questions, options, and explanations in English language only.';
    } else if (language === 'Both') {
      languageInstruction = 'Generate each question in English as the primary language. Also include a "translations" array with one object for Hindi translation containing: language, questionText, options (same optionLabels), and explanation.';
    }

    const bloomsInstruction = bloomsTaxonomy
      ? `Focus on Bloom's Taxonomy level: "${bloomsTaxonomy}".`
      : 'Vary Bloom\'s Taxonomy levels across questions. For each question, include the bloomsTaxonomy level (Remember, Understand, Apply, Analyze, Evaluate, or Create).';

    let topicText = '';
    if (topic) topicText += ` on the topic "${topic}"`;
    if (subTopic) topicText += `, specifically sub-topic "${subTopic}"`;
    if (chapter) topicText += ` from chapter "${chapter}"`;

    const systemPrompt = 'You are an expert question generator for government competitive exams. Generate high-quality questions with rich metadata. Always return a JSON object with a "questions" key containing an array.';

    // Build the question structure based on language
    const bilingualExtension = language === 'Both' ? `,
      "translations": [
        {
          "language": "Hindi",
          "questionText": "...(Hindi translation)...",
          "options": [
            {"optionLabel": "A", "optionText": "...(Hindi)..."},
            {"optionLabel": "B", "optionText": "...(Hindi)..."},
            {"optionLabel": "C", "optionText": "...(Hindi)..."},
            {"optionLabel": "D", "optionText": "...(Hindi)..."}
          ],
          "explanation": "...(Hindi explanation)..."
        }
      ]` : '';

    const userPrompt = `Generate ${count} ${questionType} questions for ${categoryName} exam on ${subject}${topicText} with ${difficulty} difficulty.
${languageInstruction}
${bloomsInstruction}

Return a JSON object with a "questions" key containing an array with this exact structure:

{
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
      "detailedSolution": "...(detailed step-by-step solution)...",
      "bloomsTaxonomy": "Remember|Understand|Apply|Analyze|Evaluate|Create",
      "cognitiveLevel": "Knowledge|Comprehension|Application|Analysis|Synthesis|Evaluation",
      "tags": ["tag1", "tag2"],
      "subject": "${subject}",
      "topic": "${topic || ''}",
      "marks": 1,
      "estimatedTime": 60,
      "difficulty": "${difficulty}"${bilingualExtension}
    }
  ]
}

Rules:
- Each question must have exactly 4 options labeled A, B, C, D
- correctAnswer must be one of: A, B, C, D
- tags should be 2-4 relevant topic/concept keywords
- estimatedTime is in seconds
- detailedSolution should be a thorough explanation${language === 'Both' ? '\n- Include accurate Hindi translations in the translations array' : ''}`;

    let content;

    if (type === 'gemini') {
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 12000,
          responseMimeType: 'application/json'
        }
      });

      if (typeof response.text === 'string') {
        content = response.text;
      } else if (response.candidates?.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content?.parts) {
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
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 8000,
      });
      content = completion.choices[0].message.content;
    }

    // Clean and parse JSON response
    let questions;

    const repairJSON = (jsonString) => {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = jsonString.match(/\[[\s\S]*\]/);
      }

      if (!jsonMatch) {
        const startBrace = jsonString.indexOf('{');
        const startBracket = jsonString.indexOf('[');

        if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;

          for (let i = startBrace; i < jsonString.length; i++) {
            const char = jsonString[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
          }

          if (braceCount > 0) {
            const lastCompleteQuestion = jsonString.lastIndexOf('}');
            if (lastCompleteQuestion !== -1) {
              let extracted = jsonString.substring(startBrace, lastCompleteQuestion + 1);
              const openArrays = (extracted.match(/\[/g) || []).length;
              const closeArrays = (extracted.match(/\]/g) || []).length;
              const openBraces = (extracted.match(/\{/g) || []).length;
              const closeBraces = (extracted.match(/\}/g) || []).length;

              for (let i = 0; i < openArrays - closeArrays; i++) extracted += ']';
              for (let i = 0; i < openBraces - closeBraces; i++) extracted += '}';

              return extracted;
            }
          }
        }
      }

      return jsonMatch ? jsonMatch[0] : jsonString;
    };

    const cleanJSON = (jsonString) => {
      let cleaned = repairJSON(jsonString);
      cleaned = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
        .replace(/:\s*([^",\[\]{}\\s][^",\[\]{}\n]*?)([,}\]])/g, (match, value, ending) => {
          if (!/^(true|false|null|\d+\.?\d*)$/.test(value.trim())) {
            return `: "${value}"${ending}`;
          }
          return match;
        });
      return cleaned;
    };

    try {
      const cleanedContent = cleanJSON(content);
      const parsed = JSON.parse(cleanedContent);

      if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
      } else if (Array.isArray(parsed)) {
        questions = parsed;
      } else {
        const keys = Object.keys(parsed);
        for (const key of keys) {
          if (Array.isArray(parsed[key])) {
            questions = parsed[key];
            break;
          }
        }
        if (!questions) throw new Error('No questions array found in response structure');
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);

      try {
        const jsonObjectMatch = content.match(/\{[\s\S]*"questions"[\s\S]*\}/);
        if (jsonObjectMatch) {
          const cleaned = cleanJSON(jsonObjectMatch[0]);
          const parsed = JSON.parse(cleaned);
          if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions;
          }
        }

        if (!questions) {
          const jsonArrayMatch = content.match(/\[[\s\S]*\]/);
          if (jsonArrayMatch) {
            questions = JSON.parse(cleanJSON(jsonArrayMatch[0]));
          }
        }

        if (!questions) {
          throw new Error(`Failed to parse JSON. Original error: ${parseError.message}`);
        }
      } catch (fallbackError) {
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }

    // Validate and normalize structure
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
        detailedSolution: q.detailedSolution || '',
        subject: q.subject || subject,
        topic: q.topic || topic || '',
        subTopic: subTopic || '',
        chapter: chapter || '',
        marks: q.marks || 1,
        difficulty: q.difficulty || difficulty,
        estimatedTime: q.estimatedTime || null,
        language: language,
        questionType: questionType || 'MCQ',
        // Metadata (optional — admin can edit before saving)
        bloomsTaxonomy: q.bloomsTaxonomy || undefined,
        cognitiveLevel: q.cognitiveLevel || undefined,
        tags: Array.isArray(q.tags) ? q.tags : [],
        // Translations array (new schema)
        translations: []
      };

      // Build translations array for bilingual questions
      if (language === 'Both' && q.translations && Array.isArray(q.translations)) {
        questionData.translations = q.translations.map(t => ({
          language: t.language,
          questionText: t.questionText || '',
          options: (t.options || []).map(opt => ({
            optionText: opt.optionText,
            optionLabel: opt.optionLabel
          })),
          explanation: t.explanation || '',
          detailedSolution: t.detailedSolution || ''
        }));
      } else if (language === 'Hindi') {
        // Primary is Hindi, no translations needed (just set language)
        questionData.language = 'Hindi';
      }

      return questionData;
    });

    return validatedQuestions;
  } catch (error) {
    console.error('AI Generation Error:', error);

    if (error.status === 429 || error.statusCode === 429) {
      throw new Error('API rate limit exceeded. Please try again later or check your API quota.');
    }

    throw new Error(`Failed to generate questions: ${error.message}`);
  }
};
