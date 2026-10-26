import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { addDep, ensureTimeline } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await ensureTimeline(session.sql);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const itemId = String(body.item_id || '');
    const dependsOn = String(body.depends_on_id || '');
    const result = await addDep(session.sql, session.userId, itemId, dependsOn);
    if (!result.ok) return NextResponse.json({ error: result.error || 'Rejected' }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('timeline_dep_post', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await session.sql`
      DELETE FROM timeline_deps WHERE item_id = ${String(body.item_id)}::uuid AND depends_on_id = ${String(body.depends_on_id)}::uuid
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('timeline_dep_del', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
