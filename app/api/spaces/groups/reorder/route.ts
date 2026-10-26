import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { reorderSpaceGroups } from '@/lib/spaces';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    await reorderSpaceGroups(session.sql, session.userId, ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('space_groups_reorder', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
