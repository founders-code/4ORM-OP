import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { outbound } from './outbound';
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
  isArticleUrl,
  pool,
  readArticle,
  screenshotArticle,
  titleKey,
  whyFor,
} from './news-sources.mjs';
import { listNews, upsertNews } from './war';
import { todayKey } from './war-core.mjs';

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, unknown>;

export const FALLBACK = SEED as Array<Record<string, unknown>>;
export { NEWS_CHIPS };

const CACHED = '/api/news/thumb/';
const CACHED_OLD = '/api/news/image/';
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
  try {
    await sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`;
    await sql`ALTER TABLE news_items ADD COLUMN IF NOT EXISTS hidden_reason text`;
  } catch (err) {
    fail('news_hidden_col', err);
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

function hasCachedImage(value: string) {
  return String(value || '').startsWith(CACHED) || String(value || '').startsWith(CACHED_OLD);
}

function withTimeout<T>(run: Promise<T>, ms: number, fallback: T) {
  return Promise.race([run, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** og:image, twitter:image, first large body img, then a first-screen screenshot — stored same-origin. 6s cap so the sweep never stalls on one photo. */
async function imageFor(sql: Sql, ownerId: string, url: string, feedImage = '') {
  return withTimeout((async () => {
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
    if (!image && url && !GOOGLE.test(url)) {
      const shot = await screenshotArticle(url).catch(() => '');
      if (shot) {
        image = await cacheImage(sql, ownerId, shot, url).catch((err) => {
          fail('news_shot', err);
          return '';
        });
      }
    }
    return { image, summary };
  })(), 6000, { image: '', summary: '' });
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

function pickStories(all: Candidate[], max = 80) {
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
      AND (impact IS NULL OR impact = '' OR source IS NULL OR source = '' OR image_url IS NULL OR image_url = '' OR (image_url NOT LIKE '/api/news/image/%' AND image_url NOT LIKE '/api/news/thumb/%'))
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
  const needImage = rows.filter((row) => !hasCachedImage(String(row.image_url || '')) && row.url && !GOOGLE.test(String(row.url))).slice(0, 40);
  await pool(needImage, 8, async (row: Row) => {
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
    if (hasCachedImage(String(row.image_url || ''))) score += 2;
    const age = (Date.now() - new Date(String(row.published_at)).getTime()) / 86400000;
    score += age <= 1 ? 3 : age <= 2 ? 2 : 1;
    return { url, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0]?.url;
  if (!top) return;
  await sql`UPDATE news_items SET is_top = (url = ${top}) WHERE owner_id = ${ownerId} AND (is_top OR url = ${top})`;
}

async function enrichWithLlm(stories: Row[]) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key || !stories.length) return stories;
  const slice = stories.slice(0, 24).map((story) => ({
    title: String(story.title || ''),
    summary: String(story.summary || '').slice(0, 280),
    url: String(story.url || ''),
  }));
  try {
    const res = await outbound('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2200,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You tag Canadian fintech/compliance news for 4orm Finance (recorded consumer suitability evidence, not an AI company). Return JSON only: {"items":[{"url":"","summary":"one line","why":"Why it matters to 4orm","category":"Compliance|AI & governance|Mortgage/brokerage|Automation/regtech|Fraud|Payments/FINTRAC|Competitors|Housing market","impact":"Opportunity|Threat|Regulatory"}]}. Hyphens, not dashes. Never invent a URL.',
          },
          { role: 'user', content: JSON.stringify({ items: slice }) },
        ],
      }),
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return stories;
    const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content || '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return stories;
    const parsed = JSON.parse(text.slice(start, end + 1)) as { items?: Array<Record<string, string>> };
    const byUrl = new Map((parsed.items || []).map((row) => [String(row.url || ''), row]));
    return stories.map((story) => {
      const hit = byUrl.get(String(story.url || ''));
      if (!hit) return story;
      const category = NEWS_CHIPS.includes(String(hit.category || '')) ? hit.category : story.category;
      const impact = ['Opportunity', 'Threat', 'Regulatory'].includes(String(hit.impact || '')) ? hit.impact : story.impact;
      return {
        ...story,
        summary: hit.summary || story.summary,
        why_it_matters: hit.why || story.why_it_matters,
        category,
        impact,
      };
    });
  } catch (err) {
    fail('news_llm', err);
    return stories;
  }
}

/** Enrich posted or swept stories (cover photo, summary, tags) and save each one as soon as it is ready. */
export async function saveStories(sql: Sql, ownerId: string, stories: Row[], deadline: number) {
  const day = todayKey();
  const enriched = Date.now() < deadline - 8000 ? await enrichWithLlm(stories) : stories;
  const prepared: Row[] = enriched.map((story) => {
    const url = String(story.url || '');
    const posted = String(story.image_url || story.image || '');
    const summary = String(story.summary || '');
    const blob = `${story.title || ''} ${summary}`;
    const meta = finish({ title: String(story.title || ''), summary, topic: String(story.topic || ''), tier: String(story.tier || '') });
    const category = NEWS_CHIPS.includes(String(story.category || '')) ? String(story.category) : meta.category;
    return {
      ...story,
      url,
      category,
      summary,
      feed_image: posted,
      image_url: hasCachedImage(posted) ? posted : '',
      impact: story.impact || impactOf(category, blob, String(story.tier || '')),
      why_it_matters: story.why_it_matters || story.whyItMatters || whyFor(category, blob),
      source: story.source || hostOf(url),
    };
  });
  let saved = await upsertNews(sql, ownerId, prepared, day);
  let thumbs = prepared.filter((story) => hasCachedImage(String(story.image_url || ''))).length;
  const need = prepared.filter((story) => !hasCachedImage(String(story.image_url || '')) && String(story.url || ''));
  await pool(need, 8, async (story: Row) => {
    const found = await imageFor(sql, ownerId, String(story.url || ''), String(story.feed_image || ''));
    if (!found.image && !found.summary) return;
    if (found.image) thumbs += 1;
    saved += await upsertNews(sql, ownerId, [{
      ...story,
      summary: String(story.summary || '') || found.summary,
      image_url: found.image || story.image_url,
    }], day);
  }, deadline);
  return { saved, thumbs };
}

/** The daily sweep: every source, 4orm-relevant only, newest and Canadian first, cover photos cached. */
export async function sweepNews(sql: Sql, ownerId: string, budgetMs = 45000) {
  await ensureNewsTables(sql);
  const deadline = Date.now() + budgetMs;
  let saved = 0;
  let thumbs = 0;
  try {
    const known = await sql`
      SELECT title, url FROM news_items WHERE owner_id = ${ownerId} AND published_at >= now() - interval '40 days'
    `;
    const skip = new Set((known as Row[]).map((row) => titleKey(String(row.title || ''))));
    const skipUrl = new Set((known as Row[]).map((row) => String(row.url || '')).filter(Boolean));
    const feedBudget = Math.max(2500, Math.min(14000, deadline - Date.now() - 6000));
    const candidates = ((await collectCandidates(skip, feedBudget)) as Candidate[]).filter((row) => isArticleUrl(row.link || row.url || ''));
    const picked = pickStories(candidates);
    let blocked = false;
    let decoded = 0;
    for (const row of picked) {
      if (!row.google) {
        row.url = row.link;
        continue;
      }
      if (!blocked && decoded < 16 && Date.now() < deadline - 4000) {
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
    })).filter((row) => isArticleUrl(String(row.url || '')) && !skipUrl.has(String(row.url || '')));
    const result = await saveStories(sql, ownerId, stories, Math.max(Date.now() + 500, deadline - 1500));
    saved = typeof result === 'number' ? result : result.saved;
    thumbs = typeof result === 'number' ? 0 : result.thumbs;
  } catch (err) {
    fail('news_sweep', err);
  }
  if (Date.now() < deadline - 800) {
    try {
      await backfill(sql, ownerId, deadline);
    } catch (err) {
      fail('news_backfill', err);
    }
  }
  try {
    await markTop(sql, ownerId);
  } catch (err) {
    fail('news_top', err);
  }
  try {
    const items = await listNews(sql, ownerId);
    return { items, saved, thumbs };
  } catch (err) {
    fail('news_sweep', err);
    return { items: [], saved, thumbs };
  }
}

/** Full sweep then stamp the last-run time so Refresh can report "found N new". */
export async function runNewsSweep(sql: Sql, ownerId: string, budgetMs = 55000) {
  const result = await sweepNews(sql, ownerId, budgetMs);
  await markSwept(sql, ownerId);
  return result;
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


/** The most recent 8:00 or 11:00 America/Los_Angeles that has already passed. */

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

/** Sweep when the latest 8am or 11am Pacific slot has not been swept yet. Marks swept only after the run finishes. */
