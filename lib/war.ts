import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { fail } from './log';
import { allowArea, allowPriority, parseDue } from './guard.mjs';
import { NEWS_CATEGORIES, asNeeds, asSteps, extractCommitments, fallbackPlan, todayKey } from './war-core.mjs';
import { SEED_URLS, isArticleUrl, isJunkNews } from './news-sources.mjs';

type Sql = NeonQueryFunction<false, false>;

function listOf(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function listPlans(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT item_id, steps, needs, draft, updated_at
    FROM item_plans
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    itemId: String(row.item_id || ''),
    steps: asSteps(listOf(row.steps)),
    needs: asNeeds(listOf(row.needs)),
    draft: String(row.draft || ''),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : null,
  }));
}

export async function savePlan(sql: Sql, ownerId: string, input: {
  itemId: string;
  steps: unknown;
  needs: unknown;
  draft: string;
  push?: boolean;
  title?: string;
  area?: string;
  due?: string | null;
}) {
  const itemId = String(input.itemId || '').trim().slice(0, 80);
  if (!itemId) return null;
  const steps = asSteps(input.steps);
  const needs = asNeeds(input.needs);
  const draft = String(input.draft || '').slice(0, 4000);
  await sql`
    INSERT INTO item_plans (owner_id, item_id, steps, needs, draft, updated_at)
    VALUES (${ownerId}, ${itemId}, ${JSON.stringify(steps)}::jsonb, ${JSON.stringify(needs)}::jsonb, ${draft}, now())
    ON CONFLICT (owner_id, item_id)
    DO UPDATE SET steps = EXCLUDED.steps, needs = EXCLUDED.needs, draft = EXCLUDED.draft, updated_at = now()
  `;
  const created: Array<Record<string, unknown>> = [];
  if (input.push) {
    const area = allowArea(String(input.area || 'other')) || 'other';
    const priority = allowPriority('high') || 'high';
    const parsed = parseDue(input.due ?? null);
    const due = parsed.ok ? parsed.iso : null;
    const existing = await sql`
      SELECT title FROM items
      WHERE owner_id = ${ownerId} AND plan_of = ${itemId}
        AND status <> 'done' AND status <> 'dropped'
    `;
    const have = new Set((existing as Array<{ title?: string }>).map((row) => String(row.title || '').toLowerCase()));
    for (const step of steps) {
      if (have.has(step.text.toLowerCase())) continue;
      have.add(step.text.toLowerCase());
      const rows = await sql`
        INSERT INTO items (owner_id, title, area, status, priority, due, owner, source, plan_of)
        VALUES (${ownerId}, ${step.text}, ${area}, 'new', ${priority}, ${due}, 'Chad', 'plan', ${itemId})
        RETURNING id, title, area, status, priority, due, owner, source, category, waiting_on, plan_of
      `;
      const row = rows[0] as Record<string, unknown> | undefined;
      if (row) {
        created.push({
          id: String(row.id),
          title: String(row.title || ''),
          area: String(row.area || area),
          status: String(row.status || 'new'),
          priority: String(row.priority || priority),
          due: row.due ? new Date(String(row.due)).getTime() : null,
          owner: String(row.owner || 'Chad'),
          source: 'plan',
          category: '',
          waitingOn: '',
          planOf: itemId,
        });
      }
    }
  }
  return { itemId, steps, needs, draft, created };
}

export async function syncCommitments(sql: Sql, ownerId: string, notes: Array<{ id: string; date: string; others: string[]; improve: string[]; intel: Array<{ value?: string }> }>) {
  const found = extractCommitments(notes);
  for (const row of found) {
    await sql`
      INSERT INTO commitments (owner_id, text, source_note_id, made_on, status)
      VALUES (${ownerId}, ${row.text}, ${row.sourceNoteId}, ${row.madeOn}, 'open')
      ON CONFLICT (owner_id, source_note_id, text) DO NOTHING
    `;
  }
}

export async function listCommitments(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT id, text, source_note_id, made_on, status
    FROM commitments
    WHERE owner_id = ${ownerId}
    ORDER BY made_on DESC NULLS LAST, created_at DESC
    LIMIT 80
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    text: String(row.text || ''),
    sourceNoteId: String(row.source_note_id || ''),
    madeOn: row.made_on ? String(row.made_on).slice(0, 10) : '',
    status: String(row.status || 'open'),
  }));
}

export async function setCommitment(sql: Sql, ownerId: string, id: string, status: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (status !== 'done' && status !== 'open' && status !== 'decked') return null;
  const rows = await sql`
    UPDATE commitments
    SET status = ${status}
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id, text, source_note_id, made_on, status
  `;
  return rows[0] || null;
}

function newsRow(row: Record<string, unknown>, day: string) {
  return {
    id: String(row.id),
    category: String(row.category || ''),
    title: String(row.title || ''),
    summary: String(row.summary || ''),
    whyItMatters: String(row.why_it_matters || ''),
    source: String(row.source || ''),
    impact: String(row.impact || ''),
    url: String(row.url || ''),
    image: String(row.image_url || ''),
    image_url: String(row.image_url || ''),
    publishedAt: row.published_at ? new Date(String(row.published_at)).getTime() : null,
    isTop: row.is_top === true,
    sweptOn: row.swept_on ? String(row.swept_on).slice(0, 10) : day,
  };
}

function isShownNews(row: Record<string, unknown>) {
  const url = String(row.url || '');
  if (!url || SEED_URLS.has(url)) return false;
  if (row.hidden === true) return false;
  if (!isArticleUrl(url)) return false;
  if (isJunkNews(String(row.title || ''), url, String(row.summary || ''))) return false;
  return true;
}

export async function listNews(sql: Sql, ownerId: string, day = todayKey(), span = 30) {
  const days = span <= 1 ? 1 : span <= 7 ? 7 : 45;
  const rows = await sql`
    SELECT id, category, title, summary, why_it_matters, source, impact, url, published_at, is_top, swept_on, image_url, hidden
    FROM news_items
    WHERE owner_id = ${ownerId}
      AND COALESCE(hidden, false) = false
      AND published_at >= now() - (${days}::int * interval '1 day')
    ORDER BY is_top DESC, published_at DESC NULLS LAST
    LIMIT 200
  `;
  const real = (rows as Array<Record<string, unknown>>).filter(isShownNews);
  if (real.length) return real.map((row) => newsRow(row, day));
  const latest = await sql`
    SELECT id, category, title, summary, why_it_matters, source, impact, url, published_at, is_top, swept_on, image_url, hidden
    FROM news_items
    WHERE owner_id = ${ownerId}
      AND COALESCE(hidden, false) = false
    ORDER BY is_top DESC, published_at DESC NULLS LAST
    LIMIT 200
  `;
  const live = (latest as Array<Record<string, unknown>>).filter(isShownNews);
  return live.map((row) => newsRow(row, day));
}

const IMPACTS = ['Opportunity', 'Threat', 'Regulatory'];

/** Upsert by url (title when there is no url). A stored image or summary is never wiped by an empty value. */
export async function upsertNews(sql: Sql, ownerId: string, items: Array<Record<string, unknown>>, day = todayKey()) {
  const seen = new Set<string>();
  let saved = 0;
  for (const item of items.slice(0, 60)) {
    const title = String(item.title || '').trim().slice(0, 180);
    if (!title) continue;
    const category = String(item.category || 'Compliance').trim().slice(0, 80);
    const summary = String(item.summary || '').trim().slice(0, 500);
    const why = String(item.why_it_matters || item.whyItMatters || item.why || '').trim().slice(0, 300);
    const source = String(item.source || '').trim().slice(0, 80);
    const rawImpact = String(item.impact || '').trim();
    const impact = IMPACTS.find((name) => name.toLowerCase() === rawImpact.toLowerCase()) || '';
    const url = String(item.url || item.link || '').trim().slice(0, 600);
    if (url && !/^https?:\/\//i.test(url)) continue;
    const key = url || `title:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rawImage = String(item.image_url || item.image || '').trim().slice(0, 600);
    const image = /^\/api\/news\/(?:image|thumb)\/[0-9a-f-]{36}$/i.test(rawImage) ? rawImage : '';
    const isTop = item.is_top === true || item.isTop === true;
    const rawWhen = item.published_at || item.publishedAt;
    const when = rawWhen ? new Date(typeof rawWhen === 'number' ? rawWhen : String(rawWhen)) : new Date();
    const published = Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
    try {
      if (url) {
        const updated = await sql`
          UPDATE news_items SET title = ${title}, category = ${category},
            summary = COALESCE(NULLIF(${summary}, ''), summary),
            why_it_matters = COALESCE(NULLIF(${why}, ''), why_it_matters),
            source = COALESCE(NULLIF(${source}, ''), source),
            impact = COALESCE(NULLIF(${impact}, ''), impact),
            image_url = COALESCE(NULLIF(${image}, ''), image_url),
            published_at = ${published}, is_top = (is_top OR ${isTop}), swept_on = ${day}::date
          WHERE owner_id = ${ownerId} AND url = ${url}
          RETURNING id
        `;
        if (!updated.length) {
          await sql`
            INSERT INTO news_items (owner_id, category, title, summary, why_it_matters, source, impact, url, image_url, published_at, is_top, swept_on)
            VALUES (${ownerId}, ${category}, ${title}, ${summary}, ${why}, ${source}, ${impact}, ${url}, ${image}, ${published}, ${isTop}, ${day}::date)
          `;
        }
      } else {
        const dupe = await sql`SELECT id FROM news_items WHERE owner_id = ${ownerId} AND url = '' AND title = ${title} LIMIT 1`;
        if (!dupe.length) {
          await sql`
            INSERT INTO news_items (owner_id, category, title, summary, why_it_matters, source, impact, url, published_at, is_top, swept_on)
            VALUES (${ownerId}, ${category}, ${title}, ${summary}, ${why}, ${source}, ${impact}, ${url}, ${published}, ${isTop}, ${day}::date)
          `;
        }
      }
      saved += 1;
    } catch (err) {
      fail('news_upsert', err);
    }
  }
  return saved;
}

export async function replaceNews(sql: Sql, ownerId: string, items: Array<Record<string, unknown>>, day = todayKey()) {
  await upsertNews(sql, ownerId, items, day);
  return listNews(sql, ownerId, day);
}

export async function newsCategories(sql: Sql, ownerId: string) {
  const rows = await sql`SELECT news_categories FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
  const stored = listOf(rows[0]?.news_categories).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 24);
  return stored.length ? stored : NEWS_CATEGORIES.slice();
}

export async function saveNewsCategories(sql: Sql, ownerId: string, categories: unknown) {
  const list = (Array.isArray(categories) ? categories : []).map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean).slice(0, 24);
  const next = list.length ? list : NEWS_CATEGORIES.slice();
  await sql`
    INSERT INTO owner_settings (owner_id, news_categories)
    VALUES (${ownerId}, ${JSON.stringify(next)}::jsonb)
    ON CONFLICT (owner_id)
    DO UPDATE SET news_categories = EXCLUDED.news_categories
  `;
  return next;
}

async function modelPlan(system: string, user: string) {
  const anthropic = env('ANTHROPIC_API_KEY');
  if (anthropic) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropic,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env('CEO_MODEL') || 'claude-sonnet-4-5',
        max_tokens: 700,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return '';
    const body = await res.json() as { content?: Array<{ text?: string }> };
    return (body.content || []).map((block) => block.text || '').join('\n');
  }
  const openai = env('OPENAI_API_KEY');
  if (!openai) return '';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${openai}` },
    body: JSON.stringify({
      model: env('CEO_MODEL') || 'gpt-4o-mini',
      max_tokens: 700,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return '';
  const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content || '';
}

export async function advisePlan(input: { title: string; area?: string; steps?: string[]; record?: string }) {
  const base = fallbackPlan(input);
  const system = 'You plan one action for Chad at 4orm Finance. Return JSON only: {"steps":["..."],"needs":["..."],"draft":"..."}. steps is 2 to 4 concrete actions. needs is people, docs, or slots. draft is notes, or a ready-to-send email when the task is outreach. Hyphens only. Do not say Sign. Do not describe 4orm as an AI company. Do not invent a dollar figure or a person who is not in the record.';
  const user = JSON.stringify({
    title: input.title,
    area: input.area || '',
    existingSteps: input.steps || [],
    record: String(input.record || '').slice(0, 4000),
  });
  try {
    const text = await modelPlan(system, user);
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as { steps?: unknown; needs?: unknown; draft?: unknown };
      const steps = asSteps(parsed.steps);
      if (steps.length >= 2) {
        return {
          steps,
          needs: asNeeds(parsed.needs),
          draft: String(parsed.draft || '').replace(/[\u2013\u2014]/g, '-').slice(0, 4000),
        };
      }
    }
  } catch {
    /* the desk plan still fills the window */
  }
  return base;
}
