import { NextResponse } from 'next/server';
import { claimBudget } from '@/lib/db';
import { withCreds } from '@/lib/creds';
import { createEvent, moveEvent } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { calendarPayload, extendCalendar } from '@/lib/sync';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

function shapeEvents(events: Array<{ id: string; start: number; dur: number; title: string; join?: string }>) {
  return events.map((event) => ({
    id: event.id,
    start: event.start,
    dur: event.dur,
    title: event.title,
    color: '#2E6BF2',
    join: event.join || '',
  }));
}

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ events: [], calendarUntil: 0 });
    const url = new URL(req.url);
    const parsedFrom = Date.parse(url.searchParams.get('from') || '');
    const parsedTo = Date.parse(url.searchParams.get('to') || '');
    const from = Number.isFinite(parsedFrom) ? parsedFrom : Date.now() - 24 * 60 * 60 * 1000;
    const to = Number.isFinite(parsedTo) ? parsedTo : Date.now() + 14 * 24 * 60 * 60 * 1000;
    const creds = await loadCredsFor(session.userId);
    const result = await withCreds(creds, () => extendCalendar(session.sql!, session.userId, from, to));
    if (!result.ok) {
      const cached = (await calendarPayload(session.sql, session.userId)) as Array<{ id: string; start: number; dur: number; title: string }>;
      return NextResponse.json({
        events: shapeEvents(cached),
        calendarUntil: 0,
        error: cached.length ? '' : 'Calendar could not be read.',
      });
    }
    return NextResponse.json({ events: shapeEvents(result.events), calendarUntil: result.until });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ events: [], calendarUntil: 0, error: 'Calendar could not be read.' });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const start = Number(body?.start);
    const dur = Math.max(15, Math.min(Number(body?.dur) || 30, 180));
    const title = String(body?.title || '').trim().slice(0, 180);
    if (!Number.isFinite(start)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    if (!id && title) {
      const created = await withCreds(creds, () => createEvent(start, dur, title));
      if (!created) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
      return NextResponse.json({ id: created, start, dur, title });
    }
    if (!/^[\w-]+$/.test(id)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const events = (await calendarPayload(session.sql, session.userId)) as Array<{ id: string; dur: number; start: number; title: string }>;
    const current = events.find((event) => event.id === id);
    const length = current?.dur || dur;
    const moved = await withCreds(creds, () => moveEvent(id, start, length));
    if (!moved) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    const next = events.map((event) => (event.id === id ? { ...event, start } : event));
    await session.sql`
      INSERT INTO calendar_cache (owner_id, events, fetched_at)
      VALUES (${session.userId}, ${JSON.stringify(next)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET events = EXCLUDED.events, fetched_at = now()
    `;
    return NextResponse.json({ id, start });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
  }
}
