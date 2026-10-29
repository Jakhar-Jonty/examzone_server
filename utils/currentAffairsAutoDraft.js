// Daily current-affairs drafts from official PIB releases. Each pick is drafted
// by AI (note + bilingual MCQs) and saved as a *draft* — an admin reviews and
// publishes it from Current Affairs in the admin panel. Nothing goes live on its own.
import CurrentAffair from '../models/CurrentAffair.js';
import User from '../models/User.js';
import { draftCurrentAffair } from './aiCurrentAffairs.js';
import { fetchPibReleases, fetchPibReleaseText } from './newsFeeds.js';
import { istDateKey } from './istDay.js';

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
  const drafted = [];
  const errors = [];
  for (const pick of picks) {
    try {
      const sourceText = await fetchPibReleaseText(pick.url);
      if (sourceText.length < 300) throw new Error('release text too short');
      const region = /haryana/i.test(sourceText) ? 'Haryana' : 'National';
      const draft = await draftCurrentAffair({ sourceText, region, questionCount });
      await CurrentAffair.create({
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
    } catch (err) {
      errors.push(`${pick.title.slice(0, 60)}: ${err.message}`);
      // out of AI quota: stop for today instead of failing every remaining pick
      if (/quota|rate|429|exhausted/i.test(err.message)) break;
    }
  }
  return { drafted, considered: releases.length, skipped: releases.length - picks.length, errors };
};
