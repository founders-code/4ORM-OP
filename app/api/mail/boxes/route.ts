import { NextResponse } from 'next/server';
import { isUniqueViolation } from '@/lib/db';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function ensureBoxes(sql: NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']) {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS email_boxes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    org text NOT NULL DEFAULT '',
    color text NOT NULL DEFAULT '#2e6bf2',
    closed boolean NOT NULL DEFAULT false,
    position int NOT NULL DEFAULT 0,
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, key)
  )`;
  await sql`ALTER TABLE email_boxes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`CREATE TABLE IF NOT EXISTS email_box_addresses (
    owner_id text NOT NULL,
    box_key text NOT NULL,
    email text NOT NULL,
    PRIMARY KEY (owner_id, box_key, email)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS email_box_tags (
    owner_id text NOT NULL,
    box_key text NOT NULL,
    tag text NOT NULL,
    PRIMARY KEY (owner_id, box_key, tag)
  )`;
  await sql`ALTER TABLE email_box_addresses ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE email_box_tags ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
}

function asBoxes(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ boxes: [] });
    await ensureBoxes(session.sql);
    const rows = await session.sql`
      SELECT key, name, org, color, closed, position, extra
      FROM email_boxes
      WHERE owner_id = ${session.userId} AND deleted_at IS NULL
      ORDER BY position ASC, created_at ASC
    `;
    const tags = await session.sql`
      SELECT box_key, tag FROM email_box_tags WHERE owner_id = ${session.userId} AND deleted_at IS NULL
    `;
    const addrs = await session.sql`
      SELECT box_key, email FROM email_box_addresses WHERE owner_id = ${session.userId} AND deleted_at IS NULL
    `;
    const tagMap: Record<string, string[]> = {};
    const addrMap: Record<string, string[]> = {};
    (tags || []).forEach((t: { box_key?: string; tag?: string }) => {
      const k = String(t.box_key || '');
      if (!k) return;
      tagMap[k] = tagMap[k] || [];
      tagMap[k].push(String(t.tag || ''));
    });
    (addrs || []).forEach((a: { box_key?: string; email?: string }) => {
      const k = String(a.box_key || '');
      if (!k) return;
      addrMap[k] = addrMap[k] || [];
      addrMap[k].push(String(a.email || ''));
    });
    const boxes = (rows || []).map((r: { key?: string; name?: string; org?: string; color?: string; closed?: boolean; extra?: Record<string, unknown> }) => {
      const extra = (r.extra && typeof r.extra === 'object') ? r.extra : {};
      return Object.assign({}, extra, {
        id: r.key,
        n: r.name,
        o: r.org,
        c: r.color,
        closed: !!r.closed,
        tags: tagMap[String(r.key)] || extra.tags || [],
        addrs: addrMap[String(r.key)] || extra.addrs || []
      });
    });
    return NextResponse.json({ boxes });
  } catch (err) {
    fail('mail_boxes', err);
    return NextResponse.json({ boxes: [] }, { status: 500 });
  }
}

type BoxRow = { key: string; name: string; org: string; color: string; closed: boolean; position: number; extra: string; tags: string[]; addrs: string[] };

/** Client boxes → rows. Duplicate keys collapse to the last one sent. */
function readBoxes(raw: unknown): BoxRow[] {
  const byKey = new Map<string, BoxRow>();
  asBoxes(raw).forEach((b, i) => {
    const key = String(b.id || b.key || `b${i}`).slice(0, 40);
    const tags = (Array.isArray(b.tags) ? b.tags : [])
      .map((tag: unknown) => String(tag || '').trim().toLowerCase().replace(/^#/, '').slice(0, 40))
      .filter(Boolean);
    const addrs = (Array.isArray(b.addrs) ? b.addrs : [])
      .map((email: unknown) => String(email || '').trim().toLowerCase().slice(0, 120))
      .filter(Boolean);
    byKey.set(key, {
      key,
      name: String(b.n || b.name || 'Box').slice(0, 80),
      org: String(b.o || b.org || '').slice(0, 120),
      color: String(b.c || b.color || '#2e6bf2').slice(0, 16),
      closed: !!b.closed,
      position: i,
      extra: JSON.stringify(b),
      tags: [...new Set(tags)],
      addrs: [...new Set(addrs)],
    });
  });
  return [...byKey.values()];
}

/**
 * Saves the full box list in one transaction: each box is upserted by key (a previously removed box
 * with the same key comes back), its tags/addresses are reconciled, and boxes the client no longer
 * sends are soft-deleted (deleted_at), never hard-deleted. An empty list is refused unless the body
 * says { confirmEmpty: true }, so a failed client load can never wipe every box.
 */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql) return NextResponse.json({ saved: false, error: 'Unavailable' }, { status: 503 });
    if (!body || String(body.action || 'save') !== 'save') {
      return NextResponse.json({ saved: false, error: 'Unknown action.' }, { status: 400 });
    }
    const sql = session.sql;
    const ownerId = session.userId;
    await ensureBoxes(sql);
    const boxes = readBoxes(body.boxes);
    if (!boxes.length && body.confirmEmpty !== true) {
      return NextResponse.json({ saved: false, error: 'Refusing to remove every box. Send confirmEmpty: true to do that.' }, { status: 400 });
    }
    const keys = boxes.map((b) => b.key);
    // Soft-delete removed boxes first so a new box may reuse a removed box's name (live-name unique index).
    const queries = [sql`
      UPDATE email_boxes SET deleted_at = now()
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND NOT (key = ANY(${keys}::text[]))
    `];
    for (const b of boxes) {
      queries.push(sql`
        INSERT INTO email_boxes (owner_id, key, name, org, color, closed, position, extra)
        VALUES (${ownerId}, ${b.key}, ${b.name}, ${b.org}, ${b.color}, ${b.closed}, ${b.position}, ${b.extra}::jsonb)
        ON CONFLICT (owner_id, key) DO UPDATE SET
          name = EXCLUDED.name, org = EXCLUDED.org, color = EXCLUDED.color, closed = EXCLUDED.closed,
          position = EXCLUDED.position, extra = EXCLUDED.extra, deleted_at = NULL
      `);
      queries.push(sql`
        UPDATE email_box_tags SET deleted_at = now()
        WHERE owner_id = ${ownerId} AND box_key = ${b.key} AND deleted_at IS NULL AND NOT (tag = ANY(${b.tags}::text[]))
      `);
      queries.push(sql`
        INSERT INTO email_box_tags (owner_id, box_key, tag)
        SELECT ${ownerId}, ${b.key}, t FROM unnest(${b.tags}::text[]) AS t
        ON CONFLICT (owner_id, box_key, tag) DO UPDATE SET deleted_at = NULL
      `);
      queries.push(sql`
        UPDATE email_box_addresses SET deleted_at = now()
        WHERE owner_id = ${ownerId} AND box_key = ${b.key} AND deleted_at IS NULL AND NOT (email = ANY(${b.addrs}::text[]))
      `);
      queries.push(sql`
        INSERT INTO email_box_addresses (owner_id, box_key, email)
        SELECT ${ownerId}, ${b.key}, e FROM unnest(${b.addrs}::text[]) AS e
        ON CONFLICT (owner_id, box_key, email) DO UPDATE SET deleted_at = NULL
      `);
    }
    await sql.transaction(queries);
    return NextResponse.json({ saved: true, n: boxes.length });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ saved: false, error: 'Two boxes share a name. Rename one and save again.' }, { status: 409 });
    }
    fail('mail_boxes_save', err);
    return NextResponse.json({ saved: false, error: 'Could not save boxes.' }, { status: 500 });
  }
}
