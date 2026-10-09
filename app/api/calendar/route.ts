import { NextResponse } from 'next/server';
import { claimBudget } from '@/lib/db';
import { moveEvent } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { calendarPayload } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const start = Number(body?.start);
    if (!/^[\w-]+$/.test(id) || !Number.isFinite(start)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const events = (await calendarPayload(session.sql, session.userId)) as Array<{ id: string; dur: number; start: number; title: string }>;
    const current = events.find((event) => event.id === id);
    const dur = current?.dur || Number(body?.dur) || 30;
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    }
    const moved = await moveEvent(id, start, dur);
    if (!moved) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const next = events.map((event) => (event.id === id ? { ...event, start } : event));
    await session.sql`
      INSERT INTO calendar_cache (owner_id, events, fetched_at)
      VALUES (${session.userId}, ${JSON.stringify(next)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET events = EXCLUDED.events, fetched_at = now()
    `;
    return NextResponse.json({ id, start });
  } catch {
    fail('calendar_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
