import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { ensureTimeline } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await ensureTimeline(session.sql);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title || body.n || 'New item').trim().slice(0, 180);
    const pipeline = String(body.pipeline || body.p || 'corporate');
    const rawKind = String(body.kind || 'span');
    const kind = pipeline === 'milestones' || pipeline === 'goals' ? 'milestone' : rawKind === 'ms' ? 'key_date' : ['span', 'key_date', 'recurring'].includes(rawKind) ? rawKind : 'span';
    const today = new Date().toISOString().slice(0, 10);
    const due = String(body.due_date || body.e || '') || today;
    const start = String(body.start_date || body.s || today);
    const rows = await session.sql`
      INSERT INTO timeline_items (owner_id, pipeline, stream, title, kind, start_date, due_date, owner_name)
      VALUES (${session.userId}, ${pipeline === 'goals' ? 'milestones' : pipeline}, ${String(body.stream || body.t || 'Inbox')}, ${title}, ${kind}, ${start}, ${due}, ${String(body.owner_name || body.o || '')})
      RETURNING *
    `;
    return NextResponse.json(rows[0] || {});
  } catch (err) {
    fail('timeline_item_post', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
