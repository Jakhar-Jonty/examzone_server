import { callModel, parseModelJson, cleanQuestions } from './aiCurrentAffairs.js';
import { HARYANA_GK_TOPICS } from './haryanaGk.js';

// What each hub topic covers, so batches spread across the syllabus instead of
// repeating the most famous facts.
const TOPIC_SCOPE = {
  history:
    'Indus/Harappan sites (Rakhigarhi, Banawali, Bhirrana, Kunal), Vedic and Mahabharata era, Battles of Panipat and Tarain, Mughal and Sikh period, 1857 revolt in Haryana, freedom movement leaders, formation of Haryana on 1 November 1966',
  geography:
    'all 22 districts and their headquarters, divisions, rivers (Yamuna, Ghaggar, Markanda, Sahibi, Tangri), lakes and wetlands, national parks and sanctuaries, Aravalli and Shivalik, climate, soils, minerals, canals, area and borders',
  culture:
    'folk dances, folk music and instruments, Saang and Ragini, fairs and festivals, temples and religious sites, handicrafts, dress and ornaments, cuisine, language and dialects (Bangru, Ahirwati, Mewati), state symbols (animal, bird, tree, flower)',
  polity:
    'Governor and Chief Ministers (in order), Vidhan Sabha seats, Lok Sabha and Rajya Sabha seats, High Court (shared with Punjab), Panchayati Raj, administrative divisions, state commissions, important state laws',
  economy:
    'agriculture and crops, Green Revolution, dairy (Murrah buffalo), industries and industrial towns, IT and auto hubs, state welfare schemes and their launch years, Parivar Pehchan Patra, power plants, state budget basics',
  sports:
    'Olympic and Commonwealth medal winners from Haryana, wrestlers, boxers, shooters, athletes, sportspersons and their districts, awards (Arjuna, Khel Ratna), notable personalities in politics, literature, film and science from Haryana',
  'current-affairs': 'recent Haryana government decisions, appointments, awards and events',
};

const buildPrompt = ({ topic, count, avoid }) => `You write exam questions for HSSC exams (Haryana CET Group C/D, Haryana Police, Gram Sachiv, Patwari).

Write ${count} multiple-choice questions on Haryana GK, topic "${topic.label}".
Cover: ${TOPIC_SCOPE[topic.key] || topic.label}.

Accuracy rules — most important:
- Use ONLY well-established facts that have appeared in HSSC/HPSC papers or standard Haryana GK books.
- If you are not fully certain of a fact (dates, counts, names, which district), do NOT write that question.
- Avoid facts that change often (current office holders, latest counts) unless you add "as of <year>" in the question.
- For each question give "confidence" from 1 to 5; only include questions you would rate 4 or 5.

Format rules:
- Exactly 4 options, one correct; wrong options plausible (other districts, other years, other people), never silly.
- Vary the correct option position. Keep options short; no "All of the above".
- Fields without "Hindi" in their name are English; fields ending in "Hindi" are natural exam Hindi in Devanagari (how HSSC papers phrase it).
- Mix difficulty: about 40% Easy, 40% Medium, 20% Hard.
- Do not repeat or rephrase any of these existing questions:
${avoid.length ? avoid.map((q) => `  - ${q}`).join('\n') : '  (none)'}

Return JSON only:
{ "questions": [{
  "questionText": "...", "questionTextHindi": "...",
  "options": ["...", "...", "...", "..."], "optionsHindi": ["...", "...", "...", "..."],
  "correctIndex": 0,
  "explanation": "one line with the fact", "explanationHindi": "...",
  "difficulty": "Easy | Medium | Hard",
  "confidence": 5
}] }`;

const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();

/**
 * Draft Haryana GK MCQs for one hub topic. Output still needs human review —
 * callers must save these as "UnderReview".
 */
export const draftHaryanaGkQuestions = async ({ topicKey, count = 15, existing = [] }) => {
  const topic = HARYANA_GK_TOPICS.find((t) => t.key === topicKey);
  if (!topic) throw new Error(`Unknown Haryana GK topic "${topicKey}"`);

  const prompt = buildPrompt({ topic, count, avoid: existing.slice(0, 80) });
  let raw;
  try {
    // the stronger model for factual accuracy; fall back if it is unavailable
    raw = await callModel(prompt, { geminiModel: 'gemini-2.5-pro', maxOutputTokens: 16384 });
  } catch {
    raw = await callModel(prompt, { maxOutputTokens: 16384 });
  }

  let data;
  try {
    data = parseModelJson(raw);
  } catch {
    throw new Error('The AI returned unreadable questions. Please try again.');
  }

  const confident = (Array.isArray(data.questions) ? data.questions : []).filter((q) => Number(q?.confidence ?? 5) >= 4);
  const seen = new Set(existing.map(normalize));
  return cleanQuestions(confident).filter((q) => {
    const key = normalize(q.questionText);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
