import { NextResponse } from 'next/server';
import { setWeight } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const principle = String(body?.principle || '').toUpperCase();
    const boost = Number(body?.boost);
    const result = await setWeight(session.sql, session.userId, principle, boost);
    if (!result) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(result);
  } catch {
    fail('ceo_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
