import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

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
}

function asBoxes(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ boxes: [] });
    await ensureBoxes(session.sql);
    const rows = await session.sql`
      SELECT key, name, org, color, closed, position, extra
      FROM email_boxes
      WHERE owner_id = ${session.userId}
      ORDER BY position ASC, created_at ASC
    `;
    const tags = await session.sql`
      SELECT box_key, tag FROM email_box_tags WHERE owner_id = ${session.userId}
    `;
    const addrs = await session.sql`
      SELECT box_key, email FROM email_box_addresses WHERE owner_id = ${session.userId}
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
    return NextResponse.json({ boxes: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ saved: false });
    await ensureBoxes(session.sql);
    const action = String(body.action || 'save');
    if (action !== 'save') return NextResponse.json({ saved: false });
    const boxes = asBoxes(body.boxes);
    await session.sql`DELETE FROM email_box_tags WHERE owner_id = ${session.userId}`;
    await session.sql`DELETE FROM email_box_addresses WHERE owner_id = ${session.userId}`;
    await session.sql`DELETE FROM email_boxes WHERE owner_id = ${session.userId}`;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const key = String(b.id || b.key || `b${i}`).slice(0, 40);
      const name = String(b.n || b.name || 'Box').slice(0, 80);
      const org = String(b.o || b.org || '').slice(0, 120);
      const color = String(b.c || b.color || '#2e6bf2').slice(0, 16);
      const closed = !!b.closed;
      await session.sql`
        INSERT INTO email_boxes (owner_id, key, name, org, color, closed, position, extra)
        VALUES (${session.userId}, ${key}, ${name}, ${org}, ${color}, ${closed}, ${i}, ${b})
      `;
      const tags = Array.isArray(b.tags) ? b.tags : [];
      for (const tag of tags) {
        const t = String(tag || '').trim().toLowerCase().replace(/^#/, '').slice(0, 40);
        if (!t) continue;
        await session.sql`INSERT INTO email_box_tags (owner_id, box_key, tag) VALUES (${session.userId}, ${key}, ${t}) ON CONFLICT DO NOTHING`;
      }
      const addrs = Array.isArray(b.addrs) ? b.addrs : [];
      for (const email of addrs) {
        const e = String(email || '').trim().toLowerCase().slice(0, 120);
        if (!e) continue;
        await session.sql`INSERT INTO email_box_addresses (owner_id, box_key, email) VALUES (${session.userId}, ${key}, ${e}) ON CONFLICT DO NOTHING`;
      }
    }
    return NextResponse.json({ saved: true, n: boxes.length });
  } catch (err) {
    fail('mail_boxes_save', err);
    return NextResponse.json({ saved: false });
  }
}
