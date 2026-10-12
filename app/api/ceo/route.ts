import { NextResponse } from 'next/server';
import { ensureCeo } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    return NextResponse.json(await ensureCeo(session.sql, session.userId));
  } catch {
    fail('ceo_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
