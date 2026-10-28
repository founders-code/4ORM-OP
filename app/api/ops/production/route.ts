import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { productionLog } from '@/lib/production-log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ days: [] }, { status: 503 });
    return NextResponse.json(await productionLog(session.sql, ownerId, 7));
  } catch (err) {
    fail('prodlog', err);
    return NextResponse.json({ days: [] }, { status: 500 });
  }
}
