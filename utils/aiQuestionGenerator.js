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

export const generateQuestions = async (examType, subject, count, difficulty, language = 'English') => {
  try {
    const client = getOpenAIClient();
    
    let languageInstruction = '';
    if (language === 'Hindi') {
      languageInstruction = 'Generate all questions, options, and explanations in Hindi language only.';
    } else if (language === 'English') {
      languageInstruction = 'Generate all questions, options, and explanations in English language only.';
    } else if (language === 'Both') {
      languageInstruction = 'Generate each question with both English and Hindi versions. For each question, provide questionText (English), questionTextHindi (Hindi), options (English), optionsHindi (Hindi), explanation (English), and explanationHindi (Hindi).';
    }
    
    const prompt = `Generate ${count} multiple choice questions for ${examType} exam on ${subject} topic with ${difficulty} difficulty. ${languageInstruction}

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
      "marks": 1
    }
  ]
}`}

Make sure each question has exactly 4 options labeled A, B, C, D. The correctAnswer must be one of these labels.`;

    const completion = await client.chat.completions.create({
      // model: 'gpt-4o-mini', // You can use 'gpt-4', 'gpt-3.5-turbo', or 'gpt-4o-mini'
      model: "gemini-2.0-flash", 
      messages: [
        {
          role: 'system',
          content: 'You are an expert question generator for government exams. Generate high-quality multiple choice questions in the exact JSON format requested. Always return a JSON object with a "questions" key containing an array of questions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;

    // Parse JSON response
    let questions;
    try {
      const parsed = JSON.parse(content);
      // Extract questions array from response
      if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
      } else if (Array.isArray(parsed)) {
        questions = parsed;
      } else {
        // Fallback: try to extract JSON array from text
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No questions array found in response');
        }
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      // Fallback: try to extract JSON array from text
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No questions array found in response. Parse error: ' + parseError.message);
      }
      questions = JSON.parse(jsonMatch[0]);
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
        marks: q.marks || 1,
        difficulty: difficulty,
        category: examType,
        language: language
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
    throw new Error(`Failed to generate questions: ${error.message}`);
  }
};

