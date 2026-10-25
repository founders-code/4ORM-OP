import { NextResponse } from 'next/server';
import { claimBudget } from '@/lib/db';
import { withCreds } from '@/lib/creds';
import { createEvent, declineCalendarEvent, deleteCalendarEvent, moveEvent, patchCalendarEvent } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
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
    const ownerId = await sessionOwner(session);
    const url = new URL(req.url);
    const parsedFrom = Date.parse(url.searchParams.get('from') || '');
    const parsedTo = Date.parse(url.searchParams.get('to') || '');
    const from = Number.isFinite(parsedFrom) ? parsedFrom : Date.now() - 24 * 60 * 60 * 1000;
    const to = Number.isFinite(parsedTo) ? parsedTo : Date.now() + 14 * 24 * 60 * 60 * 1000;
    const creds = await loadCredsFor(session.userId);
    const result = await withCreds(creds, () => extendCalendar(session.sql!, ownerId, from, to));
    if (!result.ok) {
      const cached = (await calendarPayload(session.sql, ownerId)) as Array<{ id: string; start: number; dur: number; title: string }>;
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
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const id = String(body?.id || '');
    const start = Number(body?.start);
    const dur = Math.max(15, Math.min(Number(body?.dur) || 30, 24 * 60));
    const title = String(body?.title || '').trim().slice(0, 180);
    const attendees = Array.isArray(body?.attendees)
      ? (body?.attendees as unknown[]).map((x) => String(x || '').trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 8)
      : [];
    if (!Number.isFinite(start)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    if (!id && title) {
      const location = String(body?.location || '').slice(0, 500);
      const description = String(body?.description || '').slice(0, 4000);
      const created = await withCreds(creds, () => createEvent(start, dur, title, { location, description, attendees }));
      if (!created) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
      return NextResponse.json({ id: created, start, dur, title, attendees, location });
    }
    if (!/^[\w.=@-]+$/.test(id)) {
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

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const id = String(body?.id || '');
    if (!/^[\w.=@-]+$/.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    const start = Number(body?.start);
    const dur = Math.max(15, Math.min(Number(body?.dur) || 30, 24 * 60));
    const title = String(body?.title || '').trim().slice(0, 180);
    const location = String(body?.location || '').slice(0, 500);
    const description = String(body?.description || '').slice(0, 4000);
    const attendees = Array.isArray(body?.attendees)
      ? (body?.attendees as unknown[]).map((x) => String(x || '').trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 8)
      : [];
    const fields: Record<string, unknown> = {};
    if (Number.isFinite(start)) {
      const begin = new Date(start);
      const end = new Date(start + dur * 60 * 1000);
      fields.start = { dateTime: begin.toISOString(), timeZone: 'America/Vancouver' };
      fields.end = { dateTime: end.toISOString(), timeZone: 'America/Vancouver' };
    }
    if (title) fields.summary = title;
    if (location) fields.location = location;
    if (description) fields.description = description;
    if (attendees.length) fields.attendees = attendees.map((email) => ({ email }));
    const patched = String(body?.action || '') === 'decline'
      ? await withCreds(creds, () => declineCalendarEvent(id, 'chad@4ormfinance.com'))
      : await withCreds(creds, () => patchCalendarEvent(id, fields));
    if (!patched) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    return NextResponse.json({
      id,
      start: Number.isFinite(start) ? start : undefined,
      dur,
      title,
      attendees,
      location,
    });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    const url = new URL(req.url);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const id = String(body?.id || url.searchParams.get('id') || '');
    if (!/^[\w.=@-]+$/.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    const gone = await withCreds(creds, () => deleteCalendarEvent(id));
    if (!gone) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
    return NextResponse.json({ id, deleted: true });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 400 });
  }
}
