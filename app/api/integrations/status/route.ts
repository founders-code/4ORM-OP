import { NextResponse } from 'next/server';
import { integrationStatus, refreshService } from '@/lib/integrations-status';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Real connection status, one row per service. Chad and test users only. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(await integrationStatus(session.sql, session.userId));
  } catch (err) {
    fail('integrations_status', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

/** { refresh: 'gmail'|'calendar'|'drive'|'ghl'|'granola'|'riverside' } runs that sync now, then returns the fresh list. */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as { refresh?: unknown } | null;
    const key = String(body?.refresh || '');
    if (!['gmail', 'calendar', 'drive', 'ghl', 'granola', 'riverside'].includes(key)) return NextResponse.json({ error: 'Nothing to refresh for that service' }, { status: 400 });
    try {
      await refreshService(session.sql, session.userId, key);
    } catch (err) {
      fail('integrations_refresh', err);
      return NextResponse.json({ error: 'That service did not answer', ...(await integrationStatus(session.sql, session.userId)) }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...(await integrationStatus(session.sql, session.userId)) });
  } catch (err) {
    fail('integrations_refresh', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
