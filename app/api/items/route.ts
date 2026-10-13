import { NextResponse } from 'next/server';
import { allowArea, allowPriority, allowStatus, parseDue } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

function shapeItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    area: String(row.area),
    status: String(row.status),
    priority: String(row.priority),
    due: row.due ? new Date(String(row.due)).getTime() : null,
    owner: String(row.owner || ''),
    source: String(row.source || 'manual'),
    category: row.category ? String(row.category) : '',
    waitingOn: row.waiting_on ? String(row.waiting_on) : '',
    planOf: row.plan_of ? String(row.plan_of) : '',
  };
}

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
      RETURNING id, title, area, status, priority, due, owner, source, category
    `;
    return NextResponse.json(shapeItem(rows[0] as Record<string, unknown>));
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
    const setTitle = has('title');
    const setArea = has('area');
    const setStatus = has('status');
    const setPriority = has('priority');
    const setOwner = has('owner');
    const setDue = has('due');
    const setWait = has('waitingOn');
    const title = setTitle ? String(body?.title || '').trim().slice(0, 240) : '';
    const area = setArea ? allowArea(String(body?.area || '')) : null;
    const status = setStatus ? allowStatus(String(body?.status || '')) : null;
    const priority = setPriority ? allowPriority(String(body?.priority || '')) : null;
    const parsed = setDue ? parseDue(body?.due) : { ok: true, iso: null };
    if (!/^[0-9a-f-]{36}$/i.test(id) || (setTitle && !title) || (setArea && !area) || (setStatus && !status) || (setPriority && !priority) || !parsed.ok || (!setTitle && !setArea && !setStatus && !setPriority && !setOwner && !setDue && !setWait)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const owner = setOwner ? String(body?.owner ?? '').slice(0, 80) : '';
    const waitingOn = setWait ? String(body?.waitingOn ?? '').slice(0, 80) : '';
    const dueIso = parsed.iso;
    const rows = await session.sql`
      UPDATE items
      SET title = CASE WHEN ${setTitle} THEN ${title} ELSE title END,
          area = CASE WHEN ${setArea} THEN ${area} ELSE area END,
          status = CASE WHEN ${setStatus} THEN ${status} ELSE status END,
          priority = CASE WHEN ${setPriority} THEN ${priority} ELSE priority END,
          owner = CASE WHEN ${setOwner} THEN ${owner} ELSE owner END,
          waiting_on = CASE WHEN ${setWait} THEN ${waitingOn} ELSE waiting_on END,
          due = CASE WHEN ${setDue} THEN ${dueIso}::timestamptz ELSE due END,
          updated_at = now()
      WHERE id = ${id} AND owner_id = ${session.userId}
      RETURNING id, title, area, status, priority, due, owner, source, category
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json(shapeItem(rows[0] as Record<string, unknown>));
  } catch {
    fail('items_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
