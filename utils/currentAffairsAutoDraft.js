// Daily current affairs from official PIB releases. Each pick is drafted by AI
// (note + bilingual MCQs). A draft whose every answer is found in the release
// text is published automatically (AUTO_PUBLISH_CA=false turns this off); the
// rest wait for an admin in Admin → Current Affairs.
import CurrentAffair from '../models/CurrentAffair.js';
import User from '../models/User.js';
import { draftCurrentAffair } from './aiCurrentAffairs.js';
import { fetchPibReleases, fetchPibReleaseText } from './newsFeeds.js';
import { istDateKey } from './istDay.js';
import { publishCurrentAffair, publishProblems } from '../controllers/currentAffairController.js';

// What HSSC papers tend to ask about. Haryana mentions matter most.
const SIGNALS = [
  [/haryana|chandigarh|gurugram|faridabad|panipat|hisar|rohtak|karnal|ambala|kurukshetra/i, 10],
  [/scheme|yojana|mission|abhiyan|portal|initiative|pm-[a-z]+|pradhan mantri/i, 4],
  [/instalment|crore|lakh|beneficiar/i, 3],
  [/launch|inaugurat|unveil|dedicat|foundation stone/i, 3],
  [/award|prize|honou?r|medal|ranked|ranking|index|record|first/i, 3],
  [/appoint|elected|sworn|takes charge|chief|chairman/i, 3],
  [/mou|agreement|summit|exercise|treaty|partnership/i, 2],
  [/agricultur|farmer|kisan|crop|dairy|water|sport|olympic|games/i, 2],
];
// routine releases that rarely become exam questions
const NOISE = /condolence|greet|wishes|meets|calls on|meeting|reviews|workshop|webinar|seminar|success story|journey|clarification|dividend|concludes|press conference|media briefing|tender|recruitment rules/i;

// Auto-publish only when every answer is backed by the release text and both
// languages are there; anything else waits in Admin → Current Affairs.
const norm = (s) => String(s || '').toLowerCase().replace(/[₹,]/g, '').replace(/\s+/g, ' ').trim();
export const groundedInSource = (draft, sourceText) => {
  const src = norm(sourceText);
  if (!draft.titleHindi || !draft.summaryHindi) return false;
  return (draft.questions || []).length > 0 && draft.questions.every((q) => {
    if (!q.questionTextHindi) return false;
    const ans = norm(q.options?.[q.correctIndex]).replace(/^(more than|over|about|approximately|nearly) /, '');
    if (!ans) return false;
    if (src.includes(ans)) return true;
    const words = ans.split(' ').filter((w) => w.length > 3);
    return words.length > 0 && words.every((w) => src.includes(w));
  });
};

const score = (title) =>
  NOISE.test(title) ? -1 : SIGNALS.reduce((n, [re, w]) => n + (re.test(title) ? w : 0), 0);

/**
 * Draft up to `max` new current-affairs items from today's PIB releases.
 * Returns { drafted: [titles], skipped, errors }.
 */
export const autoDraftCurrentAffairs = async ({ max = 4, questionCount = 4 } = {}) => {
  const releases = await fetchPibReleases('en');
  const seen = new Set(
    (await CurrentAffair.find({ sourceUrl: { $in: releases.map((r) => r.url) } }).select('sourceUrl').lean()).map((c) => c.sourceUrl)
  );
  const picks = releases
    .filter((r) => !seen.has(r.url))
    .map((r) => ({ ...r, score: score(r.title) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  const autoPublish = process.env.AUTO_PUBLISH_CA !== 'false';
  const drafted = [];
  const published = [];
  const errors = [];
  for (const pick of picks) {
    try {
      const sourceText = await fetchPibReleaseText(pick.url);
      if (sourceText.length < 300) throw new Error('release text too short');
      const region = /haryana/i.test(sourceText) ? 'Haryana' : 'National';
      const draft = await draftCurrentAffair({ sourceText, region, questionCount });
      const ca = await CurrentAffair.create({
        ...draft,
        date: istDateKey(),
        region,
        sourceText,
        sourceUrl: pick.url,
        aiGenerated: true,
        status: 'draft',
        tags: [...new Set([...(draft.tags || []), 'auto-pib'])].slice(0, 6),
        createdBy: admin?._id,
      });
      drafted.push(pick.title);
      if (autoPublish && admin && groundedInSource(draft, sourceText) && !publishProblems(ca).length) {
        await publishCurrentAffair(ca, admin._id);
        published.push(pick.title);
      }
    } catch (err) {
      errors.push(`${pick.title.slice(0, 60)}: ${err.message}`);
      // out of AI quota: stop for today instead of failing every remaining pick
      if (/quota|rate|429|exhausted/i.test(err.message)) break;
    }
  }
  return { drafted, published, considered: releases.length, skipped: releases.length - picks.length, errors };
};
