import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, unknown>;

/**
 * News collections (design 13b-news-saved). Two owner-scoped tables:
 * - news_collections: named groups ("Why now" proof, Investor newsletter, ...), with "Used in".
 * - news_saved: one saved story per owner+url, its note, "Used" line and the collection ids it sits in.
 * Additive and idempotent: CREATE TABLE / ADD COLUMN IF NOT EXISTS only. Deletes are soft (deleted_at).
 */
export async function ensureNewsCollections(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS news_collections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      key text,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      color text NOT NULL DEFAULT '#4a5672',
      bg text NOT NULL DEFAULT '#f5f7fb',
      used_in text NOT NULL DEFAULT '',
      position integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )`;
    await sql`CREATE TABLE IF NOT EXISTS news_saved (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      news_id text,
      url text NOT NULL DEFAULT '',
      title text NOT NULL,
      source text NOT NULL DEFAULT '',
      image text NOT NULL DEFAULT '',
      category text NOT NULL DEFAULT '',
      why text NOT NULL DEFAULT '',
      published_at timestamptz,
      note text NOT NULL DEFAULT '',
      used_in text NOT NULL DEFAULT '',
      collections jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )`;
    await sql`CREATE INDEX IF NOT EXISTS news_collections_owner_idx ON news_collections (owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS news_saved_owner_idx ON news_saved (owner_id)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS news_saved_owner_url_live_uq
      ON news_saved (owner_id, url) WHERE deleted_at IS NULL AND url <> ''`;
  } catch (err) {
    fail('news_collections_tables', err);
    throw err;
  }
}

/** The design's default collections. Seeded once per owner; a key that exists (even soft-deleted) is never re-created. */
export const DEFAULT_COLLECTIONS: Array<{ key: string; name: string; description: string; bg: string; color: string }> = [
  { key: 'why', name: '"Why now" proof', description: 'Regulator moves and fines that prove the problem is urgent', bg: '#fde9ec', color: '#e0364f' },
  { key: 'inv', name: 'Investor newsletter', description: 'Goes into the next investor update', bg: '#fff0e6', color: '#c2560c' },
  { key: 'reg', name: 'Regulator note', description: 'Material for BCFSA / FSRA / FINTRAC conversations', bg: '#efeaff', color: '#6b4fd8' },
  { key: 'li', name: 'LinkedIn ideas', description: 'Stories worth a post in your voice', bg: '#e7f0fb', color: '#0a66c2' },
  { key: 'vc', name: 'VC proof points', description: 'Market signals for VC conversations', bg: '#e4f6ee', color: '#12a36a' },
  { key: 'dp', name: 'Design-partner openers', description: 'Reasons for brokers and insurers to take a call', bg: '#eaf1fe', color: '#2e6bf2' },
  { key: 'res', name: 'Research paper', description: 'Sources for the suitability research paper', bg: '#f5f7fb', color: '#4a5672' },
  { key: 'cmp', name: 'Competitors', description: 'Moves by Vanta, Drata, Aveni and others', bg: '#fff4e0', color: '#c98408' },
];

export async function seedDefaultCollections(sql: Sql, ownerId: string) {
  for (let i = 0; i < DEFAULT_COLLECTIONS.length; i++) {
    const c = DEFAULT_COLLECTIONS[i];
    await sql`
      INSERT INTO news_collections (owner_id, key, name, description, bg, color, position)
      SELECT ${ownerId}, ${c.key}, ${c.name}, ${c.description}, ${c.bg}, ${c.color}, ${i}
      WHERE NOT EXISTS (SELECT 1 FROM news_collections WHERE owner_id = ${ownerId} AND key = ${c.key})
    `;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ids(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const out: string[] = [];
  list.forEach((v) => {
    const s = String(v || '');
    if (UUID_RE.test(s) && out.indexOf(s) < 0) out.push(s);
  });
  return out.slice(0, 50);
}

function text(value: unknown, max: number) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function shapeCollection(row: Row) {
  return {
    id: String(row.id),
    key: String(row.key || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    bg: String(row.bg || '#f5f7fb'),
    color: String(row.color || '#4a5672'),
    usedIn: String(row.used_in || ''),
    position: Number(row.position || 0),
    count: Number(row.count || 0),
  };
}

function shapeSaved(row: Row) {
  const raw = row.collections;
  const cols = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(String(raw || '[]')); } catch { return []; } })();
  return {
    id: String(row.id),
    newsId: String(row.news_id || ''),
    url: String(row.url || ''),
    title: String(row.title || ''),
    source: String(row.source || ''),
    image: String(row.image || ''),
    category: String(row.category || ''),
    why: String(row.why || ''),
    publishedAt: row.published_at ? new Date(String(row.published_at)).getTime() : 0,
    note: String(row.note || ''),
    usedIn: String(row.used_in || ''),
    collections: ids(cols),
    savedAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
  };
}

/** Live collections with live-story counts, plus every live saved story. Seeds the defaults first. */
export async function readCollections(sql: Sql, ownerId: string) {
  await ensureNewsCollections(sql);
  await seedDefaultCollections(sql, ownerId);
  const cols = await sql`
    SELECT c.id, c.key, c.name, c.description, c.bg, c.color, c.used_in, c.position,
      (SELECT count(*) FROM news_saved s
        WHERE s.owner_id = c.owner_id AND s.deleted_at IS NULL AND s.collections ? (c.id::text))::int AS count
    FROM news_collections c
    WHERE c.owner_id = ${ownerId} AND c.deleted_at IS NULL
    ORDER BY c.position ASC, c.created_at ASC
  `;
  const saved = await sql`
    SELECT id, news_id, url, title, source, image, category, why, published_at, note, used_in, collections, created_at
    FROM news_saved
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 500
  `;
  return {
    collections: (cols as Row[]).map(shapeCollection),
    saved: (saved as Row[]).map(shapeSaved),
  };
}

export async function createCollection(sql: Sql, ownerId: string, body: Row) {
  await ensureNewsCollections(sql);
  const name = text(body.name, 80);
  if (!name) return { error: 'Name required', status: 400 } as const;
  const description = text(body.description, 240);
  const pos = await sql`SELECT COALESCE(max(position), 0) + 1 AS p FROM news_collections WHERE owner_id = ${ownerId}`;
  const rows = await sql`
    INSERT INTO news_collections (owner_id, name, description, position)
    VALUES (${ownerId}, ${name}, ${description}, ${Number(pos[0]?.p || 0)})
    RETURNING id, key, name, description, bg, color, used_in, position
  `;
  return { collection: shapeCollection(rows[0] as Row) } as const;
}

export async function patchCollection(sql: Sql, ownerId: string, id: string, body: Row) {
  if (!UUID_RE.test(id)) return { error: 'Bad id', status: 400 } as const;
  await ensureNewsCollections(sql);
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const name = has('name') ? text(body.name, 80) : null;
  if (has('name') && !name) return { error: 'Name required', status: 400 } as const;
  const description = has('description') ? text(body.description, 240) : null;
  const usedIn = has('usedIn') ? text(body.usedIn, 160) : null;
  const restore = body.archived === false;
  const rows = await sql`
    UPDATE news_collections SET
      name = COALESCE(${name}, name),
      description = COALESCE(${description}, description),
      used_in = COALESCE(${usedIn}, used_in),
      deleted_at = CASE WHEN ${restore} THEN NULL ELSE deleted_at END,
      updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}::uuid AND (deleted_at IS NULL OR ${restore})
    RETURNING id, key, name, description, bg, color, used_in, position
  `;
  if (!rows.length) return { error: 'Not found', status: 404 } as const;
  return { collection: shapeCollection(rows[0] as Row) } as const;
}

export async function deleteCollection(sql: Sql, ownerId: string, id: string) {
  if (!UUID_RE.test(id)) return { error: 'Bad id', status: 400 } as const;
  await ensureNewsCollections(sql);
  const rows = await sql`
    UPDATE news_collections SET deleted_at = now(), updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}::uuid AND deleted_at IS NULL
    RETURNING id
  `;
  if (!rows.length) return { error: 'Not found', status: 404 } as const;
  return { ok: true, id } as const;
}

async function liveCollectionIds(sql: Sql, ownerId: string, want: string[]) {
  if (!want.length) return [];
  const rows = await sql`
    SELECT id::text AS id FROM news_collections
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND id::text = ANY(${want})
  `;
  const live = new Set((rows as Row[]).map((r) => String(r.id)));
  return want.filter((id) => live.has(id));
}

/**
 * Save a story into collections. One live row per owner+url: saving again updates the row.
 * mode 'merge' (default) adds to the story's collections; 'set' replaces them (Move...).
 */
export async function saveStory(sql: Sql, ownerId: string, body: Row) {
  await ensureNewsCollections(sql);
  const title = text(body.title, 300);
  if (!title) return { error: 'Title required', status: 400 } as const;
  const url = text(body.url, 1000);
  if (url && !/^https?:\/\//i.test(url)) return { error: 'Bad url', status: 400 } as const;
  const want = await liveCollectionIds(sql, ownerId, ids(body.collections));
  const note = Object.prototype.hasOwnProperty.call(body, 'note') ? String(body.note || '').slice(0, 2000) : null;
  const pub = Number(body.publishedAt || 0);
  const publishedAt = Number.isFinite(pub) && pub > 0 ? new Date(pub).toISOString() : null;
  const existing = url
    ? await sql`SELECT id, collections FROM news_saved WHERE owner_id = ${ownerId} AND url = ${url} AND deleted_at IS NULL LIMIT 1`
    : [];
  if (existing.length) {
    const prev = shapeSaved(existing[0] as Row).collections;
    const next = body.mode === 'set' ? want : prev.concat(want.filter((id) => prev.indexOf(id) < 0));
    const rows = await sql`
      UPDATE news_saved SET collections = ${JSON.stringify(next)}::jsonb,
        note = COALESCE(${note}, note), updated_at = now()
      WHERE id = ${String(existing[0].id)}::uuid AND owner_id = ${ownerId}
      RETURNING id, news_id, url, title, source, image, category, why, published_at, note, used_in, collections, created_at
    `;
    return { saved: shapeSaved(rows[0] as Row) } as const;
  }
  const rows = await sql`
    INSERT INTO news_saved (owner_id, news_id, url, title, source, image, category, why, published_at, note, collections)
    VALUES (${ownerId}, ${text(body.newsId, 80)}, ${url}, ${title}, ${text(body.source, 120)},
      ${/^\/api\/news\/(?:image|thumb)\/|^https:\/\//.test(String(body.image || '')) ? text(body.image, 1000) : ''},
      ${text(body.category, 80)}, ${text(body.why, 600)}, ${publishedAt}, ${note || ''}, ${JSON.stringify(want)}::jsonb)
    RETURNING id, news_id, url, title, source, image, category, why, published_at, note, used_in, collections, created_at
  `;
  return { saved: shapeSaved(rows[0] as Row) } as const;
}

export async function patchSaved(sql: Sql, ownerId: string, id: string, body: Row) {
  if (!UUID_RE.test(id)) return { error: 'Bad id', status: 400 } as const;
  await ensureNewsCollections(sql);
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const note = has('note') ? String(body.note || '').slice(0, 2000) : null;
  const usedIn = has('usedIn') ? text(body.usedIn, 160) : null;
  const cols = has('collections') ? JSON.stringify(await liveCollectionIds(sql, ownerId, ids(body.collections))) : null;
  const restore = body.archived === false;
  const rows = await sql`
    UPDATE news_saved SET
      note = COALESCE(${note}, note),
      used_in = COALESCE(${usedIn}, used_in),
      collections = COALESCE(${cols}::jsonb, collections),
      deleted_at = CASE WHEN ${restore} THEN NULL ELSE deleted_at END,
      updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}::uuid AND (deleted_at IS NULL OR ${restore})
    RETURNING id, news_id, url, title, source, image, category, why, published_at, note, used_in, collections, created_at
  `;
  if (!rows.length) return { error: 'Not found', status: 404 } as const;
  return { saved: shapeSaved(rows[0] as Row) } as const;
}

export async function deleteSaved(sql: Sql, ownerId: string, id: string) {
  if (!UUID_RE.test(id)) return { error: 'Bad id', status: 400 } as const;
  await ensureNewsCollections(sql);
  const rows = await sql`
    UPDATE news_saved SET deleted_at = now(), updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}::uuid AND deleted_at IS NULL
    RETURNING id
  `;
  if (!rows.length) return { error: 'Not found', status: 404 } as const;
  return { ok: true, id } as const;
}

/** Markdown export of one collection: title, description, then each story with source, date, why and note. */
export async function exportCollection(sql: Sql, ownerId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const data = await readCollections(sql, ownerId);
  const col = data.collections.find((c) => c.id === id);
  if (!col) return null;
  const rows = data.saved.filter((s) => s.collections.indexOf(id) >= 0);
  const day = (ms: number) => (ms ? new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }) : '');
  const lines = [`# ${col.name}`, '', col.description, '', `${rows.length} ${rows.length === 1 ? 'story' : 'stories'} - exported ${day(Date.now())}`, ''];
  rows.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.title}`);
    lines.push(`${[s.source, day(s.publishedAt)].filter(Boolean).join(' - ')}`);
    if (s.url) lines.push(s.url);
    if (s.why) lines.push('', `Why it matters: ${s.why}`);
    if (s.note) lines.push('', `Note: ${s.note}`);
    if (s.usedIn) lines.push('', `Used in: ${s.usedIn}`);
    lines.push('');
  });
  return { name: col.name, body: lines.join('\n') };
}
