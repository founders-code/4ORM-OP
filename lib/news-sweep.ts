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

export const FALLBACK = [
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
  const res = await fetch(url, { headers: { accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const xml = await res.text();
  const out = [];
  for (const block of xml.split(/<item>/i).slice(1, 7)) {
    const title = decode(pick(block, 'title')).slice(0, 180);
    const link = decode(pick(block, 'link')).slice(0, 400);
    const media = block.match(/<media:content[^>]+url="([^"]+)"/i);
    const picture = block.match(/<img[^>]+src="([^"]+)"/i);
    const image = String((media && media[1]) || (picture && picture[1]) || '').slice(0, 500);
    const pub = new Date(pick(block, 'pubDate'));
    if (!title || !/^https?:\/\//i.test(link) || Number.isNaN(pub.getTime())) continue;
    if (Date.now() - pub.getTime() > 30 * 86400000) continue;
    out.push({
      category: feed.category,
      title,
      summary: feed.why,
      url: link,
      image,
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

let sweepTable: Promise<boolean> | null = null;

function ensureSweepTable(sql: Sql) {
  if (!sweepTable) {
    sweepTable = (async () => {
      try {
        await sql`CREATE TABLE IF NOT EXISTS news_sweeps (owner_id text PRIMARY KEY, swept_at timestamptz NOT NULL DEFAULT now())`;
        return true;
      } catch (err) {
        fail('news_sweeps_table', err);
        sweepTable = null;
        return false;
      }
    })();
  }
  return sweepTable;
}

function pacificParts(at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

/** The most recent 8:00 or 11:00 America/Los_Angeles that has already passed. */
export function lastSweepSlot(now = new Date()) {
  const p = pacificParts(now);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(now.getTime() / 1000) * 1000;
  const slots: number[] = [];
  for (const back of [0, 1]) {
    for (const hour of [11, 8]) slots.push(Date.UTC(p.y, p.m - 1, p.d - back, hour, 0, 0) - offset);
  }
  return slots.filter((ms) => ms <= now.getTime()).sort((a, b) => b - a)[0] || now.getTime();
}

export async function lastSweptAt(sql: Sql, ownerId: string) {
  if (!(await ensureSweepTable(sql))) return 0;
  try {
    const rows = await sql`SELECT swept_at FROM news_sweeps WHERE owner_id = ${ownerId} LIMIT 1`;
    return rows[0]?.swept_at ? new Date(String(rows[0].swept_at)).getTime() : 0;
  } catch (err) {
    fail('news_sweeps_read', err);
    return 0;
  }
}

export async function markSwept(sql: Sql, ownerId: string) {
  if (!(await ensureSweepTable(sql))) return;
  try {
    await sql`
      INSERT INTO news_sweeps (owner_id, swept_at) VALUES (${ownerId}, now())
      ON CONFLICT (owner_id) DO UPDATE SET swept_at = EXCLUDED.swept_at
    `;
  } catch (err) {
    fail('news_sweeps_write', err);
  }
}

/** Sweep when the latest 8am or 11am Pacific slot has not been swept yet. Bounded so a slow feed never stalls the page. */
export async function sweepIfDue(sql: Sql, ownerId: string, force = false, budgetMs = 9000) {
  const due = force || (await lastSweptAt(sql, ownerId)) < lastSweepSlot();
  if (!due) return false;
  const run = (async () => {
    const saved = await sweepNews(sql, ownerId);
    if (saved.length) await markSwept(sql, ownerId);
    return true;
  })();
  return Promise.race([run, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), budgetMs))]);
}
