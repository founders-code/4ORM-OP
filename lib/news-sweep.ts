import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import {
  FALLBACK as SEED,
  NEWS_CHIPS,
  SEED_URLS,
  classify,
  collectCandidates,
  decodeGoogle,
  downloadImage,
  finish,
  hostOf,
  impactOf,
  pool,
  readArticle,
  titleKey,
  whyFor,
} from './news-sources.mjs';
import { listNews, upsertNews } from './war';
import { todayKey } from './war.mjs';

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, unknown>;

export const FALLBACK = SEED as Array<Record<string, unknown>>;
export { NEWS_CHIPS };

const CACHED = '/api/news/image/';
const GOOGLE = /news\.google\.com\//;

/** Fail-soft table create. Existing columns and rows are never dropped or altered. */
export async function ensureNewsTables(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS news_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      category text NOT NULL,
      title text NOT NULL,
      summary text,
      why_it_matters text,
      url text,
      source text,
      published_at timestamptz,
      impact text,
      is_top boolean NOT NULL DEFAULT false,
      image_url text,
      swept_on date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  } catch (err) {
    fail('news_items_table', err);
  }
  try {
    await sql`CREATE TABLE IF NOT EXISTS news_images (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      source_url text NOT NULL,
      mime text NOT NULL,
      data bytea NOT NULL,
      bytes integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, source_url)
    )`;
  } catch (err) {
    fail('news_images_table', err);
  }
}

/** Stores the image bytes once per source url and returns the same-origin path. */
export async function cacheImage(sql: Sql, ownerId: string, src: string, referer = '') {
  if (!/^https?:\/\//i.test(src)) return '';
  const hit = await sql`SELECT id FROM news_images WHERE owner_id = ${ownerId} AND source_url = ${src.slice(0, 1000)} LIMIT 1`;
  if (hit[0]?.id) return CACHED + String(hit[0].id);
  const img = await downloadImage(src, referer).catch(() => null);
  if (!img) return '';
  const rows = await sql`
    INSERT INTO news_images (owner_id, source_url, mime, data, bytes)
    VALUES (${ownerId}, ${src.slice(0, 1000)}, ${img.mime}, decode(${img.bytes.toString('base64')}, 'base64'), ${img.bytes.length})
    ON CONFLICT (owner_id, source_url) DO UPDATE SET mime = EXCLUDED.mime
    RETURNING id
  `;
  return rows[0]?.id ? CACHED + String(rows[0].id) : '';
}

/** og:image for the article, downloaded and cached; the feed image is the second choice. */
async function imageFor(sql: Sql, ownerId: string, url: string, feedImage = '') {
  let summary = '';
  let og = '';
  if (url && !GOOGLE.test(url)) {
    const art = await readArticle(url).catch(() => ({ image: '', description: '', url }));
    og = art.image;
    summary = art.description;
  }
  let image = '';
  for (const src of [og, feedImage]) {
    if (!src || image) continue;
    image = await cacheImage(sql, ownerId, src, url).catch((err) => {
      fail('news_image', err);
      return '';
    });
  }
  return { image, summary };
}

type Candidate = {
  title: string;
  link: string;
  url?: string;
  google: boolean;
  published: number;
  summary: string;
  source: string;
  image: string;
  tier: string;
  ca: boolean;
  topic: string;
  score: number;
};

function pickStories(all: Candidate[], max = 40) {
  const perSource: Record<string, number> = {};
  const out: Candidate[] = [];
  let google = 0;
  for (const row of all) {
    if (out.length >= max) break;
    const key = row.source.toLowerCase();
    if ((perSource[key] || 0) >= 4) continue;
    if (row.google && google >= 14) continue;
    perSource[key] = (perSource[key] || 0) + 1;
    if (row.google) google += 1;
    out.push(row);
  }
  return out;
}

/** Older rows get the new fields and a cached cover photo, a few per sweep. */
async function backfill(sql: Sql, ownerId: string, deadline: number) {
  const bare = await sql`
    SELECT id, title, summary, category, url, source, impact, image_url
    FROM news_items
    WHERE owner_id = ${ownerId}
      AND published_at >= now() - interval '35 days'
      AND (impact IS NULL OR impact = '' OR source IS NULL OR source = '' OR image_url IS NULL OR image_url NOT LIKE '/api/news/image/%')
    ORDER BY published_at DESC
    LIMIT 40
  `;
  const rows = (bare as Row[]).filter((row) => !SEED_URLS.has(String(row.url || '')));
  for (const row of rows) {
    if (!row.impact || !row.source || !NEWS_CHIPS.includes(String(row.category || ''))) {
      const blob = `${row.title || ''} ${row.summary || ''}`;
      const category = NEWS_CHIPS.includes(String(row.category || '')) ? String(row.category) : classify(blob, 'Compliance');
      try {
        await sql`
          UPDATE news_items SET category = ${category},
            impact = COALESCE(NULLIF(impact, ''), ${impactOf(category, blob, '')}),
            why_it_matters = COALESCE(NULLIF(why_it_matters, ''), ${whyFor(category, blob)}),
            source = COALESCE(NULLIF(source, ''), ${hostOf(String(row.url || ''))})
          WHERE id = ${String(row.id)}
        `;
      } catch (err) {
        fail('news_backfill', err);
      }
    }
  }
  const needImage = rows.filter((row) => !String(row.image_url || '').startsWith(CACHED) && row.url && !GOOGLE.test(String(row.url))).slice(0, 20);
  await pool(needImage, 5, async (row: Row) => {
    const found = await imageFor(sql, ownerId, String(row.url), /^https?:/i.test(String(row.image_url || '')) ? String(row.image_url) : '');
    if (found.image || found.summary) {
      await sql`
        UPDATE news_items SET image_url = COALESCE(NULLIF(${found.image}, ''), image_url),
          summary = COALESCE(NULLIF(summary, ''), ${found.summary})
        WHERE id = ${String(row.id)}
      `;
    }
  }, deadline);
}

async function markTop(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT url, impact, source, image_url, published_at
    FROM news_items
    WHERE owner_id = ${ownerId} AND url <> '' AND published_at >= now() - interval '4 days'
    ORDER BY published_at DESC
    LIMIT 60
  `;
  const scored = (rows as Row[]).filter((row) => !SEED_URLS.has(String(row.url))).map((row) => {
    const url = String(row.url);
    let score = 0;
    if (row.impact === 'Regulatory') score += 3;
    if (row.impact === 'Threat') score += 2;
    if (/\.ca$/.test(hostOf(url)) || /canad|fsra|bcfsa|fintrac|osfi|fcac/i.test(String(row.source || ''))) score += 2;
    if (String(row.image_url || '').startsWith(CACHED)) score += 2;
    const age = (Date.now() - new Date(String(row.published_at)).getTime()) / 86400000;
    score += age <= 1 ? 3 : age <= 2 ? 2 : 1;
    return { url, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0]?.url;
  if (!top) return;
  await sql`UPDATE news_items SET is_top = (url = ${top}) WHERE owner_id = ${ownerId} AND (is_top OR url = ${top})`;
}

/** Enrich posted or swept stories (cover photo, summary, tags) and save each one as soon as it is ready. */
export async function saveStories(sql: Sql, ownerId: string, stories: Row[], deadline: number) {
  const day = todayKey();
  let saved = 0;
  const done = new Set<Row>();
  await pool(stories, 6, async (story: Row) => {
    const url = String(story.url || '');
    const posted = String(story.image_url || story.image || '');
    const found = posted.startsWith(CACHED) ? { image: posted, summary: '' } : await imageFor(sql, ownerId, url, posted);
    const summary = String(story.summary || '') || found.summary;
    const blob = `${story.title || ''} ${summary}`;
    const meta = finish({ title: String(story.title || ''), summary, topic: String(story.topic || ''), tier: String(story.tier || '') });
    const category = NEWS_CHIPS.includes(String(story.category || '')) ? String(story.category) : meta.category;
    saved += await upsertNews(sql, ownerId, [{
      ...story,
      category,
      summary,
      image_url: found.image,
      impact: story.impact || impactOf(category, blob, String(story.tier || '')),
      why_it_matters: story.why_it_matters || story.whyItMatters || whyFor(category, blob),
      source: story.source || hostOf(url),
    }], day);
    done.add(story);
  }, deadline);
  const rest = stories.filter((story) => !done.has(story)).map((story) => {
    const blob = `${story.title || ''} ${story.summary || ''}`;
    const category = NEWS_CHIPS.includes(String(story.category || '')) ? String(story.category) : classify(blob, String(story.topic || 'Compliance'));
    return { ...story, category, impact: story.impact || impactOf(category, blob, String(story.tier || '')), why_it_matters: story.why_it_matters || whyFor(category, blob), source: story.source || hostOf(String(story.url || '')), image_url: '' };
  });
  if (rest.length) saved += await upsertNews(sql, ownerId, rest, day);
  return saved;
}

/** The daily sweep: every source, 4orm-relevant only, newest and Canadian first, cover photos cached. */
export async function sweepNews(sql: Sql, ownerId: string, budgetMs = 45000) {
  await ensureNewsTables(sql);
  const deadline = Date.now() + budgetMs;
  let saved = 0;
  try {
    const known = await sql`
      SELECT title FROM news_items WHERE owner_id = ${ownerId} AND published_at >= now() - interval '40 days'
    `;
    const skip = new Set((known as Row[]).map((row) => titleKey(String(row.title || ''))));
    const candidates = (await collectCandidates(skip)) as Candidate[];
    const picked = pickStories(candidates);
    let blocked = false;
    let decoded = 0;
    for (const row of picked) {
      if (!row.google) {
        row.url = row.link;
        continue;
      }
      if (!blocked && decoded < 12 && Date.now() < deadline - 18000) {
        try {
          const real = await decodeGoogle(row.link);
          if (real) row.url = real;
          decoded += 1;
        } catch {
          blocked = true;
        }
      }
      if (!row.url) row.url = row.link;
    }
    const stories = picked.map((row) => ({
      title: row.title,
      url: row.url,
      summary: row.summary,
      source: row.source,
      published_at: new Date(row.published).toISOString(),
      image: row.image,
      topic: row.topic,
      tier: row.tier,
    }));
    saved = await saveStories(sql, ownerId, stories, deadline - 6000);
  } catch (err) {
    fail('news_sweep', err);
  }
  try {
    await backfill(sql, ownerId, deadline);
  } catch (err) {
    fail('news_backfill', err);
  }
  try {
    await markTop(sql, ownerId);
  } catch (err) {
    fail('news_top', err);
  }
  try {
    const items = await listNews(sql, ownerId);
    if (items.length || saved) return items;
    await upsertNews(sql, ownerId, FALLBACK);
    return listNews(sql, ownerId);
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
  await markSwept(sql, ownerId);
  const run = (async () => {
    await sweepNews(sql, ownerId, Math.max(budgetMs - 2000, 8000));
    return true;
  })();
  return Promise.race([run, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), budgetMs))]);
}
