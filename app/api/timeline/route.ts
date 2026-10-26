import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { cleanNewsletterTasks, readTimeline } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ items: [], prefs: {}, deps: [], tasks: {} });
    const cleaned = await cleanNewsletterTasks(session.sql, session.userId);
    const data = await readTimeline(session.sql, session.userId);
    return NextResponse.json({ ...data, cleaned });
  } catch (err) {
    fail('timeline_get', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
