import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ events: [], reason: 'no database url' });
    const rows = await session.sql`
      SELECT id, level, source, message, at
      FROM ops_events
      ORDER BY at DESC
      LIMIT 80
    `;
    return NextResponse.json({
      events: rows || [],
      reason: !rows || !rows.length ? 'no events in the live tape yet' : '',
    });
  } catch (err) {
    fail('ops_events_get', err);
    return NextResponse.json({ events: [], reason: 'live tape unavailable' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => null);
    const level = String(body?.level || 'info');
    const source = String(body?.source || 'ops');
    const message = String(body?.message || '').slice(0, 500);
    if (!message) return NextResponse.json({ saved: false }, { status: 400 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    await session.sql`INSERT INTO ops_events (level, source, message) VALUES (${level}, ${source}, ${message})`;
    return NextResponse.json({ saved: true });
  } catch (err) {
    fail('ops_events_post', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
