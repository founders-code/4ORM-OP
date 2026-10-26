import { NextResponse } from 'next/server';
import { isUniqueViolation } from '@/lib/db';
import { allowArea, allowPriority, allowStatus, parseDue } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

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

const AREA_ALIAS: Record<string, string> = {
  regulator: 'outreach',
  regulatory: 'outreach',
  investor: 'investors',
  investors: 'investors',
  vc: 'investors',
};

function bucketDue(value: unknown) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return undefined;
  if (key === 'later') return null;
  if (key === 'today' || key === 'overdue') return new Date().toISOString();
  if (key === 'week' || key === 'this week') return new Date(Date.now() + 3 * 86400000).toISOString();
  return undefined;
}

function readWrite(body: Record<string, unknown> | null) {
  const title = String(body?.title || '').trim().slice(0, 180) || 'Untitled task';
  const rawArea = String(body?.area || '').trim().toLowerCase();
  const area = allowArea(rawArea) || allowArea(AREA_ALIAS[rawArea] || '') || 'other';
  const priority = allowPriority(String(body?.priority || 'normal')) || 'normal';
  const status = allowStatus(String(body?.status || 'new')) || 'new';
  const explicit = body && Object.prototype.hasOwnProperty.call(body, 'due') ? parseDue(body.due) : { ok: true, iso: null as string | null };
  const fromBucket = bucketDue(body?.bucket ?? body?.column);
  const dueIso = explicit.ok && explicit.iso ? explicit.iso : (fromBucket === undefined ? (explicit.ok ? explicit.iso : null) : fromBucket);
  return { title, area, priority, status, dueIso };
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const write = readWrite(body);
    const category = String(body?.category || '').trim().slice(0, 80);
    // Only a LIVE task with the same title counts as a duplicate; done/dropped history never blocks a new task.
    const findLive = () => session.sql!`
      SELECT id, title, area, status, priority, due, owner, source, category FROM items
      WHERE owner_id = ${session.userId}
        AND status IN ('new', 'doing', 'waiting', 'open')
        AND deleted_at IS NULL
        AND lower(trim(title)) = ${write.title.toLowerCase()}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    const dup = await findLive();
    if (dup.length) return NextResponse.json(shapeItem(dup[0] as Record<string, unknown>));
    try {
      const rows = await session.sql`
        INSERT INTO items (owner_id, title, area, status, priority, due, source, category)
        VALUES (${session.userId}, ${write.title}, ${write.area}, ${write.status}, ${write.priority}, ${write.dueIso}, 'manual', ${category})
        RETURNING id, title, area, status, priority, due, owner, source, category
      `;
      return NextResponse.json(shapeItem(rows[0] as Record<string, unknown>));
    } catch (err) {
      // A concurrent add of the same title won the live-title unique index: return that row.
      if (!isUniqueViolation(err)) throw err;
      const again = await findLive();
      if (!again.length) throw err;
      return NextResponse.json(shapeItem(again[0] as Record<string, unknown>));
    }
  } catch (err) {
    fail('items_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
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
    const setNotes = has('notes');
    const title = setTitle ? (String(body?.title || '').trim().slice(0, 240) || 'Untitled task') : '';
    const rawArea = setArea ? String(body?.area || '').trim().toLowerCase() : '';
    const area = setArea ? (allowArea(rawArea) || allowArea(AREA_ALIAS[rawArea] || '') || 'other') : null;
    const status = setStatus ? allowStatus(String(body?.status || '')) : null;
    const applyStatus = !!(setStatus && status);
    const priority = setPriority ? (allowPriority(String(body?.priority || '')) || 'normal') : null;
    const parsed = setDue ? parseDue(body?.due) : { ok: true, iso: null };
    const fromBucket = bucketDue(body?.bucket ?? body?.column);
    const applyDue = (setDue && parsed.ok) || fromBucket !== undefined;
    const dueIso = setDue && parsed.ok && parsed.iso ? parsed.iso : (fromBucket === undefined ? null : fromBucket);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!setTitle && !setArea && !setStatus && !setPriority && !setOwner && !applyDue && !setWait && !setNotes) {
      const current = await session.sql`
        SELECT id, title, area, status, priority, due, owner, source, category
        FROM items WHERE id = ${id} AND owner_id = ${session.userId}
      `;
      if (!current.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
      return NextResponse.json(shapeItem(current[0] as Record<string, unknown>));
    }
    const owner = setOwner ? String(body?.owner ?? '').slice(0, 80) : '';
    const waitingOn = setWait ? String(body?.waitingOn ?? '').slice(0, 80) : '';
    const notes = setNotes ? String(body?.notes ?? '').slice(0, 4000) : '';
    const rows = await session.sql`
      UPDATE items
      SET title = CASE WHEN ${setTitle} THEN ${title} ELSE title END,
          area = CASE WHEN ${setArea} THEN ${area} ELSE area END,
          status = CASE WHEN ${applyStatus} THEN ${status} ELSE status END,
          priority = CASE WHEN ${setPriority} THEN ${priority} ELSE priority END,
          owner = CASE WHEN ${setOwner} THEN ${owner} ELSE owner END,
          waiting_on = CASE WHEN ${setWait} THEN ${waitingOn} ELSE waiting_on END,
          notes = CASE WHEN ${setNotes} THEN ${notes} ELSE notes END,
          due = CASE WHEN ${applyDue} THEN ${dueIso}::timestamptz ELSE due END,
          updated_at = now()
      WHERE id = ${id} AND owner_id = ${session.userId}
      RETURNING id, title, area, status, priority, due, owner, source, category
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json(shapeItem(rows[0] as Record<string, unknown>));
  } catch (err) {
    fail('items_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
