import { NextResponse } from 'next/server';
import { refreshCeo } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(await refreshCeo(session.sql, session.userId));
  } catch {
    fail('ceo_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
