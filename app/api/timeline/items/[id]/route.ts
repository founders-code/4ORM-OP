import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { archiveItem, ensureTimeline, restoreItem } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await ensureTimeline(session.sql);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.restore) {
      await restoreItem(session.sql, session.userId, ctx.params.id, Array.isArray(body.deps) ? body.deps as { item_id: string; depends_on_id: string }[] : []);
      return NextResponse.json({ ok: true });
    }
    const title = body.title != null || body.n != null ? String(body.title || body.n) : null;
    const note = body.note != null ? String(body.note) : null;
    const owner = body.owner_name != null || body.o != null ? String(body.owner_name || body.o) : null;
    const st = body.status_override != null || body.st != null ? String(body.status_override || body.st || '') : null;
    const pipeline = body.pipeline != null || body.p != null ? String(body.pipeline || body.p) : null;
    const dueRaw = body.due_date != null ? String(body.due_date) : null;
    const startRaw = body.start_date != null ? String(body.start_date) : null;
    const due = dueRaw && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
    const start = startRaw === '' ? '' : (startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : null);
    const clearStart = startRaw === '';
    await session.sql`
      UPDATE timeline_items
      SET title = CASE WHEN ${title != null} THEN ${title || ''} ELSE title END,
          note = CASE WHEN ${note != null} THEN ${note || ''} ELSE note END,
          owner_name = CASE WHEN ${owner != null} THEN ${owner || ''} ELSE owner_name END,
          status_override = CASE WHEN ${st != null} THEN ${st || null} ELSE status_override END,
          pipeline = CASE WHEN ${pipeline != null} THEN ${pipeline === 'goals' ? 'milestones' : pipeline || 'corporate'} ELSE pipeline END,
          due_date = CASE WHEN ${due != null} THEN ${due}::date ELSE due_date END,
          start_date = CASE WHEN ${clearStart} THEN NULL WHEN ${start != null && start !== ''} THEN ${start}::date ELSE start_date END,
          updated_at = now()
      WHERE id = ${ctx.params.id}::uuid AND owner_id = ${session.userId}
    `;
    return NextResponse.json({ ok: true, id: ctx.params.id });
  } catch (err) {
    fail('timeline_item_patch', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const gone = await archiveItem(session.sql, session.userId, ctx.params.id);
    if (!gone) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, ...gone });
  } catch (err) {
    fail('timeline_item_del', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
