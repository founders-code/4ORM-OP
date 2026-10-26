import { NextResponse } from 'next/server';
import { snoozeMove } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const id = String(body.id || '');
    if (!session.sql || !id) return NextResponse.json({ ok: false });
    const result = await snoozeMove(session.sql, session.userId, id, String(body.reason || ''));
    return NextResponse.json(result || { ok: false });
  } catch (err) {
    fail('move_snooze', err);
    return NextResponse.json({ ok: false });
  }
}
