import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { replaceNews } from './war';
import { todayKey } from './war.mjs';

type Sql = NeonQueryFunction<false, false>;

const FEEDS = [
  { category: 'Payments / FINTRAC', q: 'FINTRAC OR OSFI OR FCAC OR "Bank of Canada" payments', why: 'Why it matters to 4orm: Canadian payments and reporting rules.' },
  { category: 'Fintech & regulation', q: '"venture capital" Canada fintech', why: 'Why it matters to 4orm: capital and fintech coverage.' },
  { category: 'Compliance', q: 'AML OR "anti-money laundering" Canada', why: 'Why it matters to 4orm: compliance work on the desk.' },
  { category: 'Mortgage', q: 'mortgage regulation Canada', why: 'Why it matters to 4orm: housing finance and the partners we call.' },
];

const FALLBACK = [
  { category: 'Payments / FINTRAC', title: 'FINTRAC - latest guidance', summary: 'Why it matters to 4orm: the reporting body for the payments desk.', url: 'https://fintrac-canafe.canada.ca/intro-eng', is_top: true },
  { category: 'Fintech & regulation', title: 'Bank of Canada - retail payments', summary: 'Why it matters to 4orm: RPAA is the payments perimeter.', url: 'https://www.bankofcanada.ca/core-functions/financial-system/retail-payments-supervision/', is_top: false },
  { category: 'Compliance', title: 'OSFI - supervision', summary: 'Why it matters to 4orm: federal prudential rules sit next to the raise.', url: 'https://www.osfi-bsif.gc.ca/en', is_top: false },
  { category: 'Mortgage', title: 'FCAC - consumer protection', summary: 'Why it matters to 4orm: consumer rules around credit and housing.', url: 'https://www.canada.ca/en/financial-consumer-agency.html', is_top: false },
];

function pick(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function pullFeed(feed: (typeof FEEDS)[number]) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.q)}&hl=en-CA&gl=CA&ceid=CA:en`;
  const res = await fetch(url, { headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!res.ok) return [];
  const xml = await res.text();
  const out = [];
  for (const block of xml.split(/<item>/i).slice(1, 7)) {
    const title = decode(pick(block, 'title')).slice(0, 180);
    const link = decode(pick(block, 'link')).slice(0, 400);
    const pub = new Date(pick(block, 'pubDate'));
    if (!title || !/^https?:\/\//i.test(link) || Number.isNaN(pub.getTime())) continue;
    if (Date.now() - pub.getTime() > 14 * 86400000) continue;
    out.push({
      category: feed.category,
      title,
      summary: feed.why,
      url: link,
      published_at: pub.toISOString(),
      is_top: false,
    });
  }
  return out;
}

export async function sweepNews(sql: Sql, ownerId: string) {
  const items: Array<Record<string, unknown>> = [];
  try {
    const batches = await Promise.all(FEEDS.map((feed) => pullFeed(feed).catch(() => [])));
    for (const batch of batches) items.push(...batch);
  } catch (err) {
    fail('news_sweep', err);
  }
  if (items.length) items[0].is_top = true;
  const batch = items.length ? items.slice(0, 24) : FALLBACK;
  try {
    return await replaceNews(sql, ownerId, batch, todayKey());
  } catch (err) {
    fail('news_sweep', err);
    return [];
  }
}
