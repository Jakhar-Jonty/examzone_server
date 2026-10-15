import { getAIClient } from './aiQuestionGenerator.js';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Models sometimes swap the English and Hindi fields; put each in its place.
const isHindi = (text) => (text.match(/[\u0900-\u097F]/g) || []).length > text.replace(/\s/g, '').length / 3;
const pair = (en, hi) => (isHindi(en) && hi && !isHindi(hi) ? [hi, en] : [en, hi]);

const buildPrompt = ({ sourceText, region, questionCount }) => `You prepare daily current affairs for students of HSSC exams (Haryana CET, Haryana Police, Gram Sachiv, Patwari).

Read the news below and write a short revision note plus multiple-choice questions, in English and Hindi.

Rules:
- Use ONLY facts stated in the news. Never add names, numbers, dates or places that are not in it.
- Focus on what exams ask: who, what, where (district), when, which scheme/award/ministry, numbers.
- Fields without "Hindi" in their name are in English; fields ending in "Hindi" are in Hindi.
- Hindi must be natural exam Hindi in Devanagari, the way HSSC papers phrase it — not a word-for-word translation.
- Write exactly ${questionCount} MCQs. Each has exactly 4 options, one correct. Wrong options must be plausible (e.g. other Haryana districts, other schemes), never silly.
- Do not make every correct answer the same letter.
- Keep option text short. Do not prefix options with letters.
- Region focus: ${region}.

Return JSON only, with this shape:
{
  "title": "headline, max 12 words",
  "titleHindi": "...",
  "summary": "2-4 sentences",
  "summaryHindi": "...",
  "keyPoints": [{ "text": "one exam fact", "textHindi": "..." }],
  "tags": ["district / scheme / person names, max 5"],
  "questions": [{
    "questionText": "...",
    "questionTextHindi": "...",
    "options": ["...", "...", "...", "..."],
    "optionsHindi": ["...", "...", "...", "..."],
    "correctIndex": 0,
    "explanation": "one line",
    "explanationHindi": "...",
    "difficulty": "Easy | Medium | Hard"
  }]
}
Give 3-5 keyPoints.

NEWS:
"""
${sourceText}
"""`;

const callModel = async (prompt) => {
  const { type, client } = getAIClient();
  if (type === 'gemini') {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.4, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    });
    if (typeof response.text === 'string') return response.text;
    return response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || '';
  }
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 6000,
  });
  return completion.choices[0].message.content;
};

/** Keep only well-formed MCQs and coerce fields to the shape the model expects. */
export const cleanQuestions = (questions) =>
  (Array.isArray(questions) ? questions : [])
    .map((q) => {
      const options = (Array.isArray(q?.options) ? q.options : []).map(str).slice(0, 4);
      const optionsHindi = (Array.isArray(q?.optionsHindi) ? q.optionsHindi : []).map(str).slice(0, 4);
      const correctIndex = Number(q?.correctIndex);
      const [questionText, questionTextHindi] = pair(str(q?.questionText), str(q?.questionTextHindi));
      const [explanation, explanationHindi] = pair(str(q?.explanation), str(q?.explanationHindi));
      const swapOptions = optionsHindi.length === 4 && options.join('') && isHindi(options.join(' ')) && !isHindi(optionsHindi.join(' '));
      return {
        questionText,
        questionTextHindi,
        options: swapOptions ? optionsHindi : options,
        optionsHindi: optionsHindi.length === 4 ? (swapOptions ? options : optionsHindi) : [],
        correctIndex: Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < 4 ? correctIndex : -1,
        explanation,
        explanationHindi,
        difficulty: DIFFICULTIES.includes(q?.difficulty) ? q.difficulty : 'Medium',
      };
    })
    .filter((q) => q.questionText && q.options.length === 4 && q.options.every(Boolean) && q.correctIndex >= 0);

/**
 * Draft a current-affairs note + MCQs from pasted news.
 * The result is a draft for an admin to review — never published directly.
 */
export const draftCurrentAffair = async ({ sourceText, region = 'Haryana', questionCount = 4 }) => {
  const raw = await callModel(buildPrompt({ sourceText, region, questionCount }));
  let data;
  try {
    data = JSON.parse(String(raw).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch {
    throw new Error('The AI returned an unreadable draft. Please try again.');
  }
  const [title, titleHindi] = pair(str(data.title), str(data.titleHindi));
  const [summary, summaryHindi] = pair(str(data.summary), str(data.summaryHindi));
  return {
    title,
    titleHindi,
    summary,
    summaryHindi,
    keyPoints: (Array.isArray(data.keyPoints) ? data.keyPoints : [])
      .map((k) => {
        const [text, textHindi] = pair(str(k?.text), str(k?.textHindi));
        return { text, textHindi };
      })
      .filter((k) => k.text || k.textHindi)
      .slice(0, 6),
    tags: (Array.isArray(data.tags) ? data.tags : []).map(str).filter(Boolean).slice(0, 5),
    questions: cleanQuestions(data.questions),
  };
};
