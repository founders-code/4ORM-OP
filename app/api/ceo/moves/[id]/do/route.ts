import { NextResponse } from 'next/server';
import { doMove } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
    const result = await doMove(session.sql, session.userId, params.id, String(body?.text || ''));
    if (!result) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    fail('ceo_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
