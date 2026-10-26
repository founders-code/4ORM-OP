import { NextResponse } from 'next/server';
import { chatCeo } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const message = String(body?.message || '');
    const result = await chatCeo(session.sql, session.userId, message);
    return NextResponse.json(result);
  } catch {
    fail('ceo_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
