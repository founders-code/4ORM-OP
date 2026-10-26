import { NextResponse } from 'next/server';
import { ceoContext } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ cash: 100, runwayDays: 1, raise: {}, pipelines: [], meetings: [], inbox: {}, commitments: [], news: [] });
    return NextResponse.json(await ceoContext(session.sql, session.userId));
  } catch (err) {
    fail('ceo_context', err);
    return NextResponse.json({ cash: 100, runwayDays: 1, raise: {}, pipelines: [], meetings: [], inbox: {}, commitments: [], news: [] });
  }
}
