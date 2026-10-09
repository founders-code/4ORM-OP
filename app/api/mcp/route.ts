import { NextResponse } from 'next/server';
import { allowArea, allowPriority, allowStatus, tokenOk } from '@/lib/guard.mjs';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const TOOLS = ['list_items', 'add_item', 'update_item', 'add_link', 'list_links'];

function denied() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: Request) {
  if (!tokenOk(req.headers.get('x-ingest-token'), process.env.INGEST_TOKEN)) return denied();
  return NextResponse.json({ tools: TOOLS });
}

export async function POST(req: Request) {
  if (!tokenOk(req.headers.get('x-ingest-token'), process.env.INGEST_TOKEN)) return denied();
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const tool = String(body?.tool || '');
    if (!TOOLS.includes(tool)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (tool === 'list_items') {
      const rows = await sql`
        SELECT id, title, area, status, priority, due, owner, source
        FROM items WHERE owner_id = ${ownerId}
        ORDER BY updated_at DESC LIMIT 100
      `;
      return NextResponse.json({
        items: rows.map((row) => ({
          id: String(row.id),
          title: String(row.title),
          area: String(row.area),
          status: String(row.status),
          priority: String(row.priority),
          due: row.due ? new Date(String(row.due)).getTime() : null,
          owner: String(row.owner || ''),
          source: String(row.source || ''),
        })),
      });
    }
    if (tool === 'list_links') {
      const rows = await sql`
        SELECT title, url, category, sub FROM links WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT 100
      `;
      return NextResponse.json({
        links: rows.map((row) => ({
          title: String(row.title),
          url: String(row.url),
          cat: String(row.category || ''),
          sub: String(row.sub || ''),
        })),
      });
    }
    if (tool === 'add_link') {
      const title = String(body?.title || '').trim().slice(0, 80);
      let url = String(body?.url || '').trim().slice(0, 500);
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const parsed = new URL(url);
      if (!title || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
        return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      }
      await sql`
        INSERT INTO links (owner_id, title, url, category, sub)
        VALUES (${ownerId}, ${title}, ${parsed.toString()}, ${String(body?.category || '').slice(0, 80)}, ${String(body?.sub || '').slice(0, 80)})
      `;
      return NextResponse.json({ title, url: parsed.toString() });
    }
    if (tool === 'add_item') {
      const title = String(body?.title || '').trim().slice(0, 180);
      const area = allowArea(String(body?.area || 'other'));
      const priority = allowPriority(String(body?.priority || 'normal'));
      if (!title || !area || !priority) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      const rows = await sql`
        INSERT INTO items (owner_id, title, area, status, priority, source)
        VALUES (${ownerId}, ${title}, ${area}, 'new', ${priority}, 'manual')
        RETURNING id, title, area, status, priority, source
      `;
      const row = rows[0];
      return NextResponse.json({
        id: String(row.id),
        title: String(row.title),
        area: String(row.area),
        status: String(row.status),
        priority: String(row.priority),
        source: 'manual',
      });
    }
    const id = String(body?.id || '');
    const status = allowStatus(String(body?.status || ''));
    if (!/^[0-9a-f-]{36}$/i.test(id) || !status) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const rows = await sql`
      UPDATE items SET status = ${status}, updated_at = now()
      WHERE id = ${id} AND owner_id = ${ownerId}
      RETURNING id, status
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id: String(rows[0].id), status: String(rows[0].status) });
  } catch {
    fail('mcp_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
