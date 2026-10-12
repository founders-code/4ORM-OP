import { NextResponse } from 'next/server';
import { doMove } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const result = await doMove(session.sql, session.userId, params.id);
    if (!result) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    fail('ceo_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
