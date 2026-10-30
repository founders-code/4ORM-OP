import { NextResponse } from 'next/server';
import { buildLog } from '@/lib/build-log';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Claude's side of Completed: what changed on 4ormop that day. Chad only. */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ items: [] });
    const day = String(new URL(req.url).searchParams.get('day') || '');
    return NextResponse.json(await buildLog(session.sql, day));
  } catch (err) {
    fail('build_log', err);
    return NextResponse.json({ items: [], error: 'Could not load the change log' }, { status: 500 });
  }
}
