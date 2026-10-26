import type { NeonQueryFunction } from '@neondatabase/serverless';
import { pacificDay } from './snapshots';

type Sql = NeonQueryFunction<false, false>;

/**
 * The monthly investor update draft. One draft per owner per month ('YYYY-MM', Vancouver), plus the items
 * added to it from Completed, News and elsewhere. Nothing here is ever sent; it is a draft Chad edits.
 * Deletes are soft (deleted_at). Adding the same source twice is idempotent (unique source_ref).
 */
export async function ensureInvestorUpdate(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS investor_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    month text NOT NULL,
    title text NOT NULL DEFAULT '',
    intro text NOT NULL DEFAULT '',
    asks text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, month)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS investor_update_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    month text NOT NULL,
    section text NOT NULL DEFAULT 'progress',
    title text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    source text NOT NULL DEFAULT 'manual',
    source_ref text NOT NULL DEFAULT '',
    url text NOT NULL DEFAULT '',
    position int NOT NULL DEFAULT 0,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS investor_update_items_ref ON investor_update_items (owner_id, month, source_ref) WHERE source_ref <> ''`;
}

export const SECTIONS = ['highlights', 'progress', 'metrics', 'news', 'asks'] as const;
export type Section = (typeof SECTIONS)[number];

export function readSection(v: unknown): Section {
  const s = String(v || '').toLowerCase();
  return (SECTIONS as readonly string[]).includes(s) ? (s as Section) : 'progress';
}

export function currentMonth() {
  return pacificDay().slice(0, 7);
}

export function readMonth(v: unknown) {
  const s = String(v || '');
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : currentMonth();
}

function monthTitle(month: string) {
  const [y, m] = month.split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${name} investor update`;
}

async function ensureDraft(sql: Sql, ownerId: string, month: string) {
  await sql`
    INSERT INTO investor_updates (owner_id, month, title)
    VALUES (${ownerId}, ${month}, ${monthTitle(month)})
    ON CONFLICT (owner_id, month) DO NOTHING
  `;
}

function shapeItem(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    section: String(r.section || 'progress'),
    title: String(r.title || ''),
    body: String(r.body || ''),
    source: String(r.source || ''),
    sourceRef: String(r.source_ref || ''),
    url: String(r.url || ''),
    position: Number(r.position) || 0,
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : '',
  };
}

export async function readDraft(sql: Sql, ownerId: string, month: string) {
  await ensureInvestorUpdate(sql);
  await ensureDraft(sql, ownerId, month);
  const head = await sql`SELECT * FROM investor_updates WHERE owner_id = ${ownerId} AND month = ${month} LIMIT 1`;
  const items = await sql`
    SELECT * FROM investor_update_items
    WHERE owner_id = ${ownerId} AND month = ${month} AND deleted_at IS NULL
    ORDER BY position ASC, created_at ASC
  `;
  const h = (head[0] || {}) as Record<string, unknown>;
  return {
    month,
    title: String(h.title || monthTitle(month)),
    intro: String(h.intro || ''),
    asks: String(h.asks || ''),
    status: String(h.status || 'draft'),
    updatedAt: h.updated_at ? new Date(String(h.updated_at)).toISOString() : '',
    items: (items as Array<Record<string, unknown>>).map(shapeItem),
  };
}

export async function patchDraft(sql: Sql, ownerId: string, month: string, input: { title?: string; intro?: string; asks?: string }) {
  await ensureInvestorUpdate(sql);
  await ensureDraft(sql, ownerId, month);
  await sql`
    UPDATE investor_updates SET
      title = COALESCE(${input.title != null ? input.title.slice(0, 200) : null}, title),
      intro = COALESCE(${input.intro != null ? input.intro.slice(0, 8000) : null}, intro),
      asks = COALESCE(${input.asks != null ? input.asks.slice(0, 4000) : null}, asks),
      updated_at = now()
    WHERE owner_id = ${ownerId} AND month = ${month}
  `;
}

/** Add an item. With a sourceRef the same thing is never added twice (a removed one comes back). */
export async function addItem(
  sql: Sql,
  ownerId: string,
  month: string,
  input: { section: Section; title: string; body: string; source: string; sourceRef: string; url: string },
) {
  await ensureInvestorUpdate(sql);
  await ensureDraft(sql, ownerId, month);
  const pos = await sql`SELECT COALESCE(max(position), 0)::int + 1 AS n FROM investor_update_items WHERE owner_id = ${ownerId} AND month = ${month}`;
  const n = Number(pos[0]?.n || 1);
  if (input.sourceRef) {
    const prior = await sql`
      SELECT id, deleted_at FROM investor_update_items WHERE owner_id = ${ownerId} AND month = ${month} AND source_ref = ${input.sourceRef} LIMIT 1
    `;
    if (prior.length) {
      const back = await sql`
        UPDATE investor_update_items SET deleted_at = NULL, updated_at = now()
        WHERE id = ${String(prior[0].id)}::uuid RETURNING *
      `;
      return { item: shapeItem(back[0] as Record<string, unknown>), existed: !prior[0].deleted_at };
    }
  }
  const rows = await sql`
    INSERT INTO investor_update_items (owner_id, month, section, title, body, source, source_ref, url, position)
    VALUES (${ownerId}, ${month}, ${input.section}, ${input.title.slice(0, 300)}, ${input.body.slice(0, 8000)},
      ${input.source.slice(0, 40)}, ${input.sourceRef.slice(0, 200)}, ${input.url.slice(0, 1000)}, ${n})
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (!rows.length) return { item: null, existed: true };
  await sql`UPDATE investor_updates SET updated_at = now() WHERE owner_id = ${ownerId} AND month = ${month}`;
  return { item: shapeItem(rows[0] as Record<string, unknown>), existed: false };
}

export async function patchItem(sql: Sql, ownerId: string, id: string, input: { title?: string; body?: string; section?: Section; position?: number; deleted?: boolean }) {
  await ensureInvestorUpdate(sql);
  const rows = await sql`
    UPDATE investor_update_items SET
      title = COALESCE(${input.title != null ? input.title.slice(0, 300) : null}, title),
      body = COALESCE(${input.body != null ? input.body.slice(0, 8000) : null}, body),
      section = COALESCE(${input.section || null}, section),
      position = COALESCE(${input.position != null && Number.isFinite(input.position) ? Math.round(input.position) : null}::int, position),
      deleted_at = CASE WHEN ${input.deleted == null}::boolean THEN deleted_at WHEN ${!!input.deleted}::boolean THEN now() ELSE NULL END,
      updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId}
    RETURNING *
  `;
  return rows[0] ? shapeItem(rows[0] as Record<string, unknown>) : null;
}

/** Plain-text version of the draft (for Copy). */
export function draftText(d: Awaited<ReturnType<typeof readDraft>>) {
  const by = (s: string) => d.items.filter((i) => i.section === s);
  const lines: string[] = [d.title, ''];
  if (d.intro) lines.push(d.intro, '');
  const label: Record<string, string> = { highlights: 'Highlights', progress: 'Progress', metrics: 'Metrics', news: 'In the news', asks: 'Asks' };
  for (const s of SECTIONS) {
    const list = by(s);
    if (!list.length && !(s === 'asks' && d.asks)) continue;
    lines.push(label[s]);
    for (const i of list) lines.push(`- ${i.title}${i.body ? `: ${i.body}` : ''}${i.url ? ` (${i.url})` : ''}`);
    if (s === 'asks' && d.asks) lines.push(d.asks);
    lines.push('');
  }
  return lines.join('\n').trim();
}
