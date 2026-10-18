/** News sweep sources and parsing. Network only, no database. The live list is NEWS_SOURCES.md. */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const NEWS_CHIPS = [
  'Compliance',
  'AI & governance',
  'Mortgage/brokerage',
  'Automation/regtech',
  'Fraud',
  'Payments/FINTRAC',
  'Competitors',
  'Housing market',
];

/** Regulator landing pages, only shown while the sweep has nothing. */
export const FALLBACK = [
  { category: 'Payments/FINTRAC', title: 'FINTRAC - latest guidance', summary: 'The reporting body for the payments desk.', why_it_matters: 'Payments and reporting rules set the perimeter 4orm documents.', source: 'FINTRAC', impact: 'Regulatory', url: 'https://fintrac-canafe.canada.ca/intro-eng', is_top: true },
  { category: 'Payments/FINTRAC', title: 'Bank of Canada - retail payments supervision', summary: 'RPAA supervision of payment service providers.', why_it_matters: 'RPAA is the payments perimeter.', source: 'Bank of Canada', impact: 'Regulatory', url: 'https://www.bankofcanada.ca/core-functions/financial-system/retail-payments-supervision/', is_top: false },
  { category: 'Compliance', title: 'OSFI - supervision', summary: 'Federal prudential supervision.', why_it_matters: 'Federal prudential rules sit next to the raise.', source: 'OSFI', impact: 'Regulatory', url: 'https://www.osfi-bsif.gc.ca/en', is_top: false },
  { category: 'Compliance', title: 'FCAC - consumer protection', summary: 'Consumer protection for credit and banking.', why_it_matters: 'Consumer rules around credit and housing.', source: 'FCAC', impact: 'Regulatory', url: 'https://www.canada.ca/en/financial-consumer-agency.html', is_top: false },
];

export const SEED_URLS = new Set(FALLBACK.map((row) => row.url));

function gcNews(dept) {
  const since = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  return `https://api.io.canada.ca/io-server/gc/news/en/v2?dept=${dept}&sort=publishedDate&orderBy=desc&publishedDate%3E=${since}&pick=30&format=atom`;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 4ormNews/1.0';

/** Fallback if NEWS_SOURCES.md is missing. The sweep prefers the markdown table. */
const FALLBACK_SOURCES = [
  { name: 'Bank of Canada', kind: 'rss', url: 'https://www.bankofcanada.ca/content_type/press-releases/feed/', tier: 'regulator', ca: true },
  { name: 'OSFI', kind: 'rss', url: gcNews('osfi'), tier: 'regulator', ca: true },
  { name: 'FINTRAC', kind: 'rss', url: gcNews('fintrac'), tier: 'regulator', ca: true },
  { name: 'FCAC', kind: 'rss', url: gcNews('financialconsumeragency'), tier: 'regulator', ca: true },
  { name: 'Competition Bureau', kind: 'rss', url: gcNews('competitionbureau'), tier: 'regulator', ca: true, filter: true },
  { name: 'Department of Finance Canada', kind: 'rss', url: gcNews('departmentfinance'), tier: 'regulator', ca: true, filter: true },
  { name: 'Newswire.ca', kind: 'rss', url: 'https://www.newswire.ca/rss/financial-services-latest-news/financial-services-latest-news-list.rss', tier: 'press', ca: false, filter: true, strict: true },
  { name: 'OSFI site', kind: 'google', q: 'site:osfi-bsif.gc.ca', tier: 'regulator', ca: true },
  { name: 'FINTRAC site', kind: 'google', q: 'site:fintrac-canafe.canada.ca', tier: 'regulator', ca: true },
  { name: 'FSRA', kind: 'google', q: 'site:fsrao.ca', tier: 'regulator', ca: true, topic: 'Mortgage/brokerage' },
  { name: 'BCFSA', kind: 'google', q: 'site:bcfsa.ca', tier: 'regulator', ca: true, topic: 'Mortgage/brokerage' },
  { name: 'AMF Quebec', kind: 'google', q: 'site:lautorite.qc.ca', tier: 'regulator', ca: true },
  { name: 'CSA', kind: 'google', q: 'site:securities-administrators.ca', tier: 'regulator', ca: true },
  { name: 'OSC', kind: 'google', q: 'site:osc.ca', tier: 'regulator', ca: true },
  { name: 'BCSC', kind: 'google', q: 'site:bcsc.bc.ca', tier: 'regulator', ca: true },
  { name: 'ASC', kind: 'google', q: 'site:asc.ca', tier: 'regulator', ca: true },
  { name: 'Canadian Mortgage Trends', kind: 'rss', url: 'https://www.canadianmortgagetrends.com/feed/', tier: 'press', ca: true, topic: 'Mortgage/brokerage' },
  { name: 'Canadian Mortgage Professional', kind: 'rss', url: 'https://www.mpamag.com/ca/rss', tier: 'press', ca: true, topic: 'Mortgage/brokerage' },
  { name: 'Mortgage Professionals Canada', kind: 'google', q: '"Mortgage Professionals Canada"', tier: 'press', ca: true, topic: 'Mortgage/brokerage' },
  { name: 'Investment Executive / Advisor.ca', kind: 'google', q: 'site:investmentexecutive.com OR site:advisor.ca', tier: 'press', ca: true, filter: true },
  { name: 'Wealth Professional', kind: 'rss', url: 'https://www.wealthprofessional.ca/rss', tier: 'press', ca: true, filter: true },
  { name: 'BetaKit', kind: 'rss', url: 'https://betakit.com/feed/', tier: 'press', ca: true, filter: true },
  { name: 'The Logic', kind: 'rss', url: 'https://thelogic.co/feed/', tier: 'press', ca: true, filter: true },
  { name: 'Financial Post', kind: 'rss', url: 'https://financialpost.com/feed', tier: 'press', ca: true, filter: true },
  { name: 'The Globe and Mail', kind: 'rss', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/business/', tier: 'press', ca: true, filter: true },
  { name: 'CREA', kind: 'rss', url: 'https://www.crea.ca/feed/', tier: 'press', ca: true, topic: 'Housing market' },
  { name: 'Reuters', kind: 'google', q: 'site:reuters.com bank regulation AI OR compliance OR "anti-money laundering"', tier: 'press', ca: false, filter: true },
  { name: 'Finextra', kind: 'rss', url: 'https://www.finextra.com/rss/headlines.aspx', tier: 'press', ca: false, filter: true },
  { name: 'FCA', kind: 'rss', url: 'https://www.fca.org.uk/news/rss.xml', tier: 'regulator', ca: false },
  { name: 'The Banker', kind: 'google', q: 'site:thebanker.com regulation OR compliance OR AI', tier: 'press', ca: false, filter: true },
  { name: 'Competitors', kind: 'google', q: 'Vanta OR Drata OR Secureframe OR Thoropass OR "Aveni AI" OR ComplyAdvantage OR Hummingbird OR AutoRek OR Fenergo compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'ComplyAdvantage', kind: 'rss', url: 'https://complyadvantage.com/feed/', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'RPAA and safeguarding', kind: 'google', q: 'FINTRAC OR RPAA OR "Bank of Canada" payments', tier: 'term', ca: true },
  { name: 'Retail Payment Activities Act', kind: 'google', q: '"Retail Payment Activities Act" OR RPAA OR safeguarding', tier: 'term', ca: true },
  { name: 'Suitability', kind: 'google', q: 'suitability advisor OR broker Canada regulator', tier: 'term', ca: true },
  { name: 'Mortgage broker regulation BC', kind: 'google', q: 'mortgage broker regulation BC OR BCFSA "mortgage broker"', tier: 'term', ca: true, topic: 'Mortgage/brokerage' },
  { name: 'AI governance finance Canada', kind: 'google', q: 'AI governance financial services Canada', tier: 'term', ca: true, topic: 'AI & governance' },
  { name: 'Fraud Canada fintech', kind: 'google', q: 'fraud Canada fintech', tier: 'term', ca: true, topic: 'Fraud' },
  { name: 'AML', kind: 'google', q: 'AML OR "anti-money laundering" Canada fintech OR bank', tier: 'term', ca: true },
  { name: 'Non-dilutive funding', kind: 'google', q: '"non-dilutive" OR IRAP OR "Alberta Innovates" fintech funding Canada', tier: 'term', ca: true },
  { name: 'Vanta', kind: 'google', q: 'Vanta compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Drata', kind: 'google', q: 'Drata compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Secureframe', kind: 'google', q: 'Secureframe compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Thoropass', kind: 'google', q: 'Thoropass compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Hummingbird', kind: 'google', q: 'Hummingbird AML OR "Hummingbird RegTech"', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Aveni', kind: 'google', q: '"Aveni AI" OR Aveni compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'AutoRek', kind: 'google', q: 'AutoRek', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Fenergo', kind: 'google', q: 'Fenergo KYC OR compliance', tier: 'competitor', ca: false, topic: 'Competitors' },
  { name: 'Medium fintech-canada', kind: 'rss', url: 'https://medium.com/feed/tag/fintech-canada', tier: 'press', ca: true, filter: true },
  { name: 'Medium regtech', kind: 'rss', url: 'https://medium.com/feed/tag/regtech', tier: 'press', ca: false, filter: true },
  { name: 'Medium aml', kind: 'rss', url: 'https://medium.com/feed/tag/aml', tier: 'press', ca: false, filter: true },
  { name: 'Medium ai-in-finance', kind: 'rss', url: 'https://medium.com/feed/tag/ai-in-finance', tier: 'press', ca: false, filter: true },
];

function flagSet(raw) {
  const flags = String(raw || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  return { filter: flags.includes('filter'), strict: flags.includes('strict') };
}

function parseNewsSourcesMd(text) {
  const rows = [];
  String(text || '').split(/\r?\n/).forEach((line) => {
    if (!/^\|/.test(line) || /^\|\s*-+\s*\|/.test(line) || /^\|\s*Kind\s*\|/i.test(line)) return;
    const cols = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cols.length < 4) return;
    const kind = String(cols[0] || '').toLowerCase();
    const name = cols[1] || '';
    const loc = cols[2] || '';
    const tier = cols[3] || 'press';
    const ca = /^(yes|true|ca|1)$/i.test(cols[4] || '');
    const topic = cols[5] || '';
    const flags = flagSet(cols[6] || '');
    if (!name || (kind !== 'rss' && kind !== 'google')) return;
    if (kind === 'rss' && !/^https?:\/\//i.test(loc)) return;
    if (kind === 'google' && !loc) return;
    const src = { name, kind, tier, ca };
    if (kind === 'rss') src.url = loc;
    else src.q = loc;
    if (topic) src.topic = topic;
    if (flags.filter) src.filter = true;
    if (flags.strict) src.strict = true;
    rows.push(src);
  });
  return rows;
}

function readNewsSourcesMd() {
  let here = '';
  try {
    here = dirname(fileURLToPath(import.meta.url));
  } catch {
    here = '';
  }
  const paths = [
    join(process.cwd(), 'NEWS_SOURCES.md'),
    join(process.cwd(), 'design-reference', 'NEWS_SOURCES.md'),
    here ? join(here, '..', 'NEWS_SOURCES.md') : '',
    join(process.cwd(), 'public', 'NEWS_SOURCES.md'),
  ].filter(Boolean);
  for (const path of paths) {
    try {
      const rows = parseNewsSourcesMd(readFileSync(path, 'utf8'));
      if (rows.length) return rows;
    } catch {
      // try the next path
    }
  }
  return [];
}

/** Live source list: NEWS_SOURCES.md when present, otherwise the fallback table. */
export function loadSources() {
  const fromDoc = readNewsSourcesMd();
  return fromDoc.length ? fromDoc : FALLBACK_SOURCES;
}

export const SOURCES = loadSources();

const RELEVANT = /\b(complian\w*|regulat\w*|regtech|supervis\w*|fintrac|osfi|fcac|rpaa|aml|anti-money|money laundering|sanction\w*|suitab\w*|kyc|mortgage\w*|broker\w*|lender\w*|underwrit\w*|fintech\w*|payments?|payment service|open banking|stablecoin\w*|fraud\w*|scam\w*|AI|artificial intelligence|generative|governance|consumer protection|securities|ciro|csa|fsra|bcfsa|amf|osc|bcsc|asc|investor protection|advis[oe]r\w*|wealth|housing|home sales|real estate|crea|vanta|drata|secureframe|thoropass|aveni|complyadvantage|non-dilutive|irap|grant\w*|venture|seed round|pre-seed|series a)\b/i;
const CORE = /\b(complian\w*|regulat\w*|regtech|supervis\w*|fintrac|osfi|fcac|rpaa|aml|anti-money|money laundering|terrorist financing|kyc|suitab\w*|mortgage\w*|brokerage\w*|mortgage broker\w*|lender\w*|fintech\w*|payment service\w*|retail payment\w*|open banking|stablecoin\w*|fraud\w*|scam\w*|consumer protection|ciro|fsra|bcfsa|investor protection|non-dilutive|irap|vanta|drata|secureframe|thoropass|aveni|complyadvantage|crea|home sales|housing market|housing starts)\b/i;
const AI_TERM = /\b(AI|artificial intelligence|generative AI|machine learning)\b/;
const FINANCE = /\b(financ\w*|bank\w*|advis[oe]r\w*|lend\w*|mortgage\w*|insur\w*|regulat\w*|complian\w*|governance|wealth|invest\w*)\b/i;

function relevant(blob) {
  return CORE.test(blob) || (AI_TERM.test(blob) && FINANCE.test(blob));
}

const COMPETITOR = /\b(vanta|drata|secureframe|thoropass|aveni|complyadvantage)\b/i;
const CANADA = /\b(canada|canadian|ontario|quebec|qu[eé]bec|b\.c\.|british columbia|alberta|manitoba|saskatchewan|nova scotia|toronto|vancouver|calgary|montreal|ottawa|fintrac|osfi|fcac|fsra|bcfsa|ciro|crea)\b/i;

const WHY = {
  'Compliance': 'Compliance expectations are moving - the case for recorded suitability evidence gets stronger. Use it in the regulator note.',
  'AI & governance': 'Rules for automated advice are forming - the 4orm audit trail is the governance evidence they will ask for.',
  'Mortgage/brokerage': 'Direct signal for the brokerage pitch - name it on design-partner calls.',
  'Automation/regtech': 'Shows where compliance automation is heading - check it against the 4orm roadmap and the deck.',
  'Fraud': 'Proof the consumer-understanding problem is real and costly - a line for the deck.',
  'Payments/FINTRAC': 'Payments and reporting rules set the perimeter 4orm documents - cite it to regulators and VCs.',
  'Competitors': 'Competitor move - watch where their positioning overlaps the 4orm evidence wedge.',
  'Housing market': 'Housing volume drives broker activity - timing context for brokerage outreach.',
};

export function decode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function plain(html) {
  return decode(decode(html)).replace(/<[^>]*>/g, ' ').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? match[1].trim() : '';
}

export function sentences(text, max = 280) {
  const clean = plain(text);
  if (!clean) return '';
  const parts = clean.match(/[^.!?]+[.!?]+(\s|$)/g) || [clean];
  let out = '';
  for (const part of parts.slice(0, 2)) {
    if ((out + part).length > max) break;
    out += part;
  }
  out = (out || clean.slice(0, max)).trim();
  return out.length >= max && !/[.!?]$/.test(out) ? `${out.slice(0, max - 3).trim()}...` : out;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function readCapped(res, cap) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= cap) {
      reader.cancel().catch(() => {});
      break;
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export async function fetchText(url, { timeout = 7000, cap = 600000, headers = {}, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    body,
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'en-CA,en;q=0.9', ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) return { ok: false, text: '', url: res.url || url };
  return { ok: true, text: await readCapped(res, cap), url: res.url || url };
}

export function parseFeed(xml) {
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  return blocks.map((raw) => {
    const block = raw.split(/<\/item>|<\/entry>/i)[0];
    const title = plain(tag(block, 'title'));
    let link = decode(tag(block, 'link')).trim();
    if (!/^https?:/i.test(link)) {
      const href = block.match(/<link[^>]+href="([^"]+)"/i);
      link = href ? decode(href[1]) : '';
    }
    if (!link) {
      const about = raw.match(/^[^>]*rdf:about="([^"]+)"/i);
      link = about ? decode(about[1]) : '';
    }
    const when = tag(block, 'pubDate') || tag(block, 'dc:date') || tag(block, 'published') || tag(block, 'updated');
    const desc = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded') || tag(block, 'content');
    const source = plain(tag(block, 'source'));
    const media = block.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i) || block.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i);
    const inline = decode(desc).match(/<img[^>]+src="([^"]+)"/i);
    return {
      title,
      link: link.trim(),
      published: Date.parse(plain(when)) || 0,
      desc,
      source,
      image: decode((media && media[1]) || (inline && inline[1]) || ''),
    };
  }).filter((row) => row.title && /^https?:\/\//i.test(row.link));
}

function googleUrl(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:30d`)}&hl=en-CA&gl=CA&ceid=CA:en`;
}

async function parseRss(text) {
  try {
    const mod = await import('rss-parser');
    const Parser = mod.default || mod;
    const parser = new Parser({ timeout: 8000 });
    const feed = await parser.parseString(text);
    return (feed.items || []).map((item) => {
      const link = String(item.link || item.guid || '').trim();
      const title = plain(item.title || '');
      const when = Date.parse(item.isoDate || item.pubDate || item.published || '') || 0;
      const desc = item.content || item['content:encoded'] || item.contentSnippet || item.summary || '';
      const image = (item.enclosure && /^image\//i.test(item.enclosure.type || '') && item.enclosure.url)
        || (Array.isArray(item.mediaContent) && item.mediaContent[0] && item.mediaContent[0].$ && item.mediaContent[0].$.url)
        || '';
      return { title, link, published: when, desc, source: item.source && item.source.title ? String(item.source.title) : '', image: String(image || '') };
    }).filter((row) => row.title && /^https?:\/\//i.test(row.link));
  } catch {
    return parseFeed(text);
  }
}

export function classify(text, fallback) {
  if (COMPETITOR.test(text)) return 'Competitors';
  if (/\b(fintrac|rpaa|retail payment\w*|payment service provider\w*|psps?|anti-money|money laundering|aml|terrorist financing|payments canada|real-time rail|open banking|stablecoin\w*)\b/i.test(text)) return 'Payments/FINTRAC';
  if (/\b(fraud\w*|scam\w*|phishing|identity theft)\b/i.test(text)) return 'Fraud';
  if (/\b(AI|artificial intelligence|generative|machine learning|algorithm\w*|model risk|governance)\b/.test(text)) return 'AI & governance';
  if (/\b(regtech|suptech|automation|automated|compliance software|compliance platform)\b/i.test(text)) return 'Automation/regtech';
  if (/\b(mortgage\w*|broker\w*|lender\w*|underwrit\w*|bcfsa|fsra)\b/i.test(text)) return 'Mortgage/brokerage';
  if (/\b(housing|home sales|home prices|real estate|rent\w*|crea|condo\w*)\b/i.test(text)) return 'Housing market';
  return fallback || 'Compliance';
}

export function impactOf(category, text, tier) {
  if (category === 'Competitors') return 'Threat';
  if (/\b(grant\w*|non-dilutive|funding program|irap|innovates|raises?|raised|pre-seed|seed round|series [a-d]|partnership|opportunit\w*|growth|rebound|rises?|surge\w*)\b/i.test(text) && tier !== 'regulator') return 'Opportunity';
  if (tier === 'regulator' || category === 'Fraud' || /\b(regulat\w*|rule\w*|guidance|consult\w*|enforc\w*|penalt\w*|fine[sd]?|sanction\w*|bill|act|amend\w*|supervis\w*|licen[cs]\w*|registration)\b/i.test(text)) return 'Regulatory';
  return 'Opportunity';
}

export function whyFor(category, text) {
  if (/\b(non-dilutive|grant\w*|irap|innovates|funding program)\b/i.test(text)) return 'Non-dilutive funding signal - check eligibility and timing against the raise.';
  if (/\b(pre-seed|seed round|series [a-d]|venture|raises?|raised)\b/i.test(text) && category !== 'Competitors') return 'Capital is moving in the category - timing signal for investor outreach.';
  return WHY[category] || WHY.Compliance;
}

function scoreOf(row) {
  let score = 0;
  if (row.tier === 'regulator') score += 4;
  if (row.tier === 'competitor') score += 3;
  if (row.ca) score += 2;
  const hits = (`${row.title} ${row.summary}`.match(new RegExp(RELEVANT.source, 'gi')) || []).length;
  score += Math.min(hits, 4);
  const ageDays = (Date.now() - row.published) / 86400000;
  score += ageDays <= 1 ? 4 : ageDays <= 3 ? 3 : ageDays <= 7 ? 2 : ageDays <= 14 ? 1 : 0;
  return score;
}

async function pullSource(src, timeout = 8000) {
  const { ok, text } = await fetchText(src.kind === 'google' ? googleUrl(src.q) : src.url, { timeout, cap: 1500000, headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
  if (!ok) return [];
  const cutoff = Date.now() - 30 * 86400000;
  const out = [];
  for (const row of await parseRss(text)) {
    if (!row.published || row.published < cutoff || row.published > Date.now() + 86400000) continue;
    let title = row.title.replace(/[\u2013\u2014]/g, '-');
    const source = row.source || src.name;
    if (src.kind === 'google' && row.source) {
      const tail = ` - ${row.source}`;
      if (title.endsWith(tail)) title = title.slice(0, -tail.length).trim();
    }
    const summary = src.kind === 'google' ? '' : sentences(row.desc);
    const blob = `${title} ${summary}`;
    if ((src.filter || src.kind === 'google') && !relevant(blob)) continue;
    const local = CANADA.test(blob) || /\.ca$/.test(hostOf(row.link));
    if (src.strict && !local) continue;
    const ca = src.ca || local;
    out.push({
      title: title.slice(0, 180),
      link: row.link,
      google: src.kind === 'google',
      published: row.published,
      summary,
      source: source.slice(0, 80),
      image: /^https?:\/\//i.test(row.image) ? row.image : '',
      tier: src.tier,
      ca,
      topic: src.topic || '',
    });
  }
  return out;
}

function titleKey(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);
}

/** Every source in parallel, filtered to 4orm-relevant, de-duped, best first. */
export async function collectCandidates(skipTitles = new Set(), budgetMs = 14000) {
  const deadline = Date.now() + Math.max(2000, budgetMs);
  const batches = await Promise.all(loadSources().map((src) => {
    const left = deadline - Date.now();
    if (left < 400) return Promise.resolve([]);
    return pullSource(src, Math.min(8000, left)).catch(() => []);
  }));
  const seen = new Set();
  const all = [];
  batches.forEach((batch) => {
    batch.sort((a, b) => b.published - a.published).slice(0, 12).forEach((row) => {
      const key = titleKey(row.title);
      if (!key || seen.has(key) || skipTitles.has(key)) return;
      seen.add(key);
      row.score = scoreOf(row);
      all.push(row);
    });
  });
  return all.sort((a, b) => b.score - a.score || b.published - a.published);
}

export { titleKey };

/** news.google.com article links hide the publisher URL; this asks Google News for it. */
export async function decodeGoogle(link) {
  const match = String(link).match(/news\.google\.com\/(?:rss\/)?articles\/([^?#/]+)/);
  if (!match) return link;
  const id = match[1];
  try {
    const raw = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    const direct = raw.match(/https?:\/\/[\x21-\x7e]+/);
    if (direct && !raw.includes('AU_yqL')) return direct[0];
  } catch {
    // fall through to the lookup
  }
  const page = await fetchText(`https://news.google.com/articles/${id}?hl=en-CA&gl=CA&ceid=CA:en`, { timeout: 7000, cap: 400000, headers: { cookie: 'CONSENT=YES+cb' } });
  if (/\/sorry\//.test(page.url)) throw new Error('blocked');
  const sg = page.text.match(/data-n-a-sg="([^"]+)"/);
  const ts = page.text.match(/data-n-a-ts="([^"]+)"/);
  if (!sg || !ts) return '';
  const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts[1]), sg[1]]);
  const req = JSON.stringify([[['Fbv4je', inner, null, 'generic']]]);
  const res = await fetchText('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    timeout: 7000,
    cap: 60000,
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `f.req=${encodeURIComponent(req)}`,
  });
  const found = res.text.match(/garturlres\\",\\"(https?:\/\/[^"\\]+)/);
  return found ? found[1] : '';
}

function metaContent(html, names) {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']?${name}["']?[^>]*>`, 'i');
    const tagHit = html.match(re);
    if (!tagHit) continue;
    const content = tagHit[0].match(/content=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = content ? decode(content[1] || content[2] || content[3] || '').trim() : '';
    if (value) return value;
  }
  return '';
}

function jsonLdImage(html) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const raw = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : [data];
      for (const node of list) {
        const img = node && (node.image || (node.primaryImageOfPage && node.primaryImageOfPage.url));
        const value = typeof img === 'string' ? img : Array.isArray(img) ? (img[0] && (img[0].url || img[0])) : (img && img.url);
        if (value) return String(value);
      }
    } catch {
      // next json-ld block
    }
  }
  return '';
}

function absUrl(value, base) {
  let image = String(value || '').trim();
  if (!image) return '';
  if (image.startsWith('//')) image = 'https:' + image;
  try {
    return new URL(image, base).toString();
  } catch {
    return '';
  }
}

function firstBodyImg(html, base) {
  const body = html.split(/<body[^>]*>/i)[1] || html;
  const tags = body.match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const src = (tag.match(/\s(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)/i) || [])[1] || '';
    if (!src) continue;
    if (/pixel|spacer|1x1|logo|icon|avatar|sprite|tracking|badge|button|share|advert/i.test(src + tag)) continue;
    const w = Number((tag.match(/\bwidth=["']?(\d+)/i) || [])[1] || 0);
    const h = Number((tag.match(/\bheight=["']?(\d+)/i) || [])[1] || 0);
    if ((w && w < 240) || (h && h < 120)) continue;
    const abs = absUrl(decode(src), base);
    if (/^https?:\/\//i.test(abs)) return abs;
  }
  return '';
}

/** A specific article URL, never a regulator or publisher homepage. */
export function isArticleUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (SEED_URLS.has(u.href.replace(/\/$/, '')) || SEED_URLS.has(String(url))) return false;
    if (path === '/' || path === '/en' || path === '/fr' || path === '/intro-eng') return false;
    if (parts.length <= 1 && !/\d{4}|article|news|press|release|blog|post|guidance|notice/i.test(path)) return false;
    if (/\/(home|index|en|fr|intro-eng)\/?$/i.test(path) && parts.length <= 1) return false;
    return true;
  } catch {
    return false;
  }
}

/** The article's og:image, twitter:image, then the first large body image. */
export async function readArticle(url) {
  const page = await fetchText(url, { timeout: 7000, cap: 500000 });
  if (!page.ok) return { image: '', description: '', url: page.url };
  const head = page.text.split(/<\/head>/i)[0] || page.text;
  let image = metaContent(head, ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'])
    || jsonLdImage(page.text);
  if (!image) {
    const rel = head.match(/<link[^>]+rel=["']?image_src["']?[^>]*href=["']([^"']+)/i);
    image = rel ? decode(rel[1]) : '';
  }
  if (!image) image = firstBodyImg(page.text, page.url);
  image = absUrl(image, page.url);
  const description = metaContent(head, ['og:description', 'description', 'twitter:description']);
  return { image: /^https?:\/\//i.test(image) ? image : '', description: description ? sentences(description) : '', url: page.url };
}

/** First-screen screenshot via Microlink when the article has no lead photo. */
export async function screenshotArticle(url) {
  const key = process.env.MICROLINK_API_KEY || '';
  const api = 'https://api.microlink.io/?url=' + encodeURIComponent(url) + '&screenshot=true&meta=false&viewport.width=1200&viewport.height=630';
  try {
    const res = await fetch(api, {
      headers: { accept: 'application/json', ...(key ? { 'x-api-key': key } : {}) },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const shot = data && data.data && data.data.screenshot && (data.data.screenshot.url || data.data.screenshot);
    return typeof shot === 'string' && /^https?:\/\//i.test(shot) ? shot : '';
  } catch {
    return '';
  }
}

/** Image bytes, capped at 2 MB. Tries with and without a referer so hotlink blocks fail over. */
export async function downloadImage(url, referer) {
  const headers = [
    referer ? { referer } : null,
    {},
    { referer: 'https://news.google.com/' },
  ].filter(Boolean);
  for (const extra of headers) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5', ...extra },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const mime = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!/^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(mime)) continue;
      const declared = Number(res.headers.get('content-length') || 0);
      if (declared > 2000000) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 2000 || bytes.length > 2000000) continue;
      return { mime: mime === 'image/jpg' ? 'image/jpeg' : mime, bytes };
    } catch {
      // next header set
    }
  }
  return null;
}

/** Category, impact and the "why it matters" line for a finished story. */
export function finish(row) {
  const blob = `${row.title} ${row.summary}`;
  const category = row.topic && row.topic !== 'Mortgage/brokerage' && row.topic !== 'Housing market' ? row.topic : classify(blob, row.topic);
  return {
    category,
    impact: impactOf(category, blob, row.tier),
    why: whyFor(category, blob),
  };
}

export async function pool(items, size, run, deadline) {
  let next = 0;
  async function lane() {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      try {
        await run(item);
      } catch {
        // one story never stops the sweep
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
}
