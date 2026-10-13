import { NextResponse } from 'next/server';
import { snoozeMove } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
