// Official news sources for the daily current-affairs drafts.
// PIB (Press Information Bureau) publishes every central government release
// as public information, with an RSS feed and a plain release page.

const UA = { 'User-Agent': 'Mozilla/5.0 (ExamZone current affairs)' };
const PIB_FEEDS = {
  en: 'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3',
  hi: 'https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=3&reg=48',
};

const decode = (s) =>
  String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const fetchText = async (url, timeoutMs = 20000) => {
  const res = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.text();
};

/** Latest PIB releases: [{ title, url, prid }] (newest first, as the feed lists them). */
export const fetchPibReleases = async (lang = 'en') => {
  const xml = await fetchText(PIB_FEEDS[lang] || PIB_FEEDS.en);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => {
      const title = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
      const url = decode(item.match(/<link>([\s\S]*?)<\/link>/)?.[1]);
      const prid = url.match(/PRID=(\d+)/i)?.[1] || null;
      return { title, url, prid };
    })
    .filter((r) => r.title && r.url && r.prid);
};

/** Plain text of one PIB release (title + body), trimmed to `max` characters. */
export const fetchPibReleaseText = async (url, max = 6000) => {
  const html = await fetchText(url);
  const text = decode(
    html
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  // the release body sits between the "Press Release" header and PIB's closing marks
  const start = text.search(/Press Release|प्रविष्टि तिथि|Posted On/i);
  let body = start >= 0 ? text.slice(start) : text;
  const end = body.search(/\*{3,}|\n\s*(Visitor Counter|Follow us on|Download PDF)/i);
  if (end > 200) body = body.slice(0, end);
  return body.slice(0, max).trim();
};
