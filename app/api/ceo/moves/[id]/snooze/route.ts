import { NextResponse } from 'next/server';
import { snoozeMove, unsnoozeMove } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const result = await snoozeMove(session.sql, session.userId, params.id, String(body?.reason || ''));
    if (!result) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    fail('ceo_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}

/** Undo for "dismiss move": un-snoozes it so it returns to the ranked list. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!/^[0-9a-f-]{36}$/i.test(String(params.id || ''))) return NextResponse.json({ error: 'Unknown move' }, { status: 400 });
    const result = await unsnoozeMove(session.sql, session.userId, params.id);
    if (!result) return NextResponse.json({ error: 'That move cannot be brought back' }, { status: 409 });
    return NextResponse.json(result);
  } catch (err) {
    fail('ceo_unsnooze', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
