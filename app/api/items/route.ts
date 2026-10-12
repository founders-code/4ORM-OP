import { NextResponse } from 'next/server';
import { allowArea, allowPriority, allowStatus, parseDue } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const title = String(body?.title || '').trim().slice(0, 180);
    const area = allowArea(String(body?.area || 'other'));
    const priority = allowPriority(String(body?.priority || 'normal'));
    if (!title || !area || !priority) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const hasDue = body && Object.prototype.hasOwnProperty.call(body, 'due');
    const parsed = hasDue ? parseDue(body.due) : { ok: true, iso: null };
    if (!parsed.ok) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const dueIso = parsed.iso;
    const rows = await session.sql`
      INSERT INTO items (owner_id, title, area, status, priority, due, source)
      VALUES (${session.userId}, ${title}, ${area}, 'new', ${priority}, ${dueIso}, 'manual')
      RETURNING id, title, area, status, priority, due, owner, source
    `;
    const row = rows[0];
    return NextResponse.json({
      id: String(row.id),
      title: String(row.title),
      area: String(row.area),
      status: String(row.status),
      priority: String(row.priority),
      due: row.due ? new Date(String(row.due)).getTime() : null,
      owner: String(row.owner || ''),
      source: String(row.source || 'manual'),
    });
  } catch {
    fail('items_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const has = (key: string) => !!body && Object.prototype.hasOwnProperty.call(body, key);
    const setStatus = has('status');
    const setPriority = has('priority');
    const setOwner = has('owner');
    const setDue = has('due');
    const status = setStatus ? allowStatus(String(body?.status || '')) : null;
    const priority = setPriority ? allowPriority(String(body?.priority || '')) : null;
    const parsed = setDue ? parseDue(body?.due) : { ok: true, iso: null };
    if (!/^[0-9a-f-]{36}$/i.test(id) || (setStatus && !status) || (setPriority && !priority) || !parsed.ok || (!setStatus && !setPriority && !setOwner && !setDue)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const owner = setOwner ? String(body?.owner ?? '').slice(0, 80) : '';
    const dueIso = parsed.iso;
    const rows = await session.sql`
      UPDATE items
      SET status = CASE WHEN ${setStatus} THEN ${status} ELSE status END,
          priority = CASE WHEN ${setPriority} THEN ${priority} ELSE priority END,
          owner = CASE WHEN ${setOwner} THEN ${owner} ELSE owner END,
          due = CASE WHEN ${setDue} THEN ${dueIso}::timestamptz ELSE due END,
          updated_at = now()
      WHERE id = ${id} AND owner_id = ${session.userId}
      RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id });
  } catch {
    fail('items_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
