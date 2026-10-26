import { NextResponse } from 'next/server';
import { claimBudget } from '@/lib/db';
import { withCreds } from '@/lib/creds';
import {
  CALENDAR_TIME_ZONE,
  type CalendarAttachment,
  type CalendarEventInput,
  type CalendarReminder,
  createEvent,
  declineCalendarEvent,
  deleteCalendarEvent,
  moveEvent,
  patchCalendarEvent,
} from '@/lib/google';
import { fail } from '@/lib/log';
import { ROOM_EMAIL, openBoard, sessionOwner } from '@/lib/session';
import { type CalEvent, calendarPayload, extendCalendar } from '@/lib/sync';
import { loadCredsFor } from '@/lib/vault';
import { CAL_ID, createOnCalendar, isSourceCalendar, moveToCalendar, sourceCalendarId, writableCalendar } from './_google-calendars';

export const dynamic = 'force-dynamic';

const EVENT_ID = /^[\w.=@-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRIVE_ID = /^[\w-]{8,}$/;

/** GET shape. Editor fields are '' / [] / null when Google had none (or the row predates them). */
function shapeEvents(events: CalEvent[]) {
  return events.map((event) => ({
    id: event.id,
    start: event.start,
    dur: event.dur,
    title: event.title,
    color: '#2E6BF2',
    join: event.join || '',
    attendees: event.attendees || [],
    location: event.location || '',
    description: event.description || '',
    reminders: event.reminders || null,
    attachments: event.attachments || [],
    extendedProperties: { private: event.privateProps || {} },
    organizer: event.organizer || '',
    organizerSelf: event.organizerSelf !== false,
  }));
}

function has(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function readAttendees(value: unknown) {
  if (!Array.isArray(value)) return [];
  const emails = value
    .map((x) => String((x && typeof x === 'object' ? (x as { email?: unknown }).email : x) || '').trim().toLowerCase())
    .filter((e) => EMAIL.test(e));
  return [...new Set(emails)].slice(0, 50);
}

/** { useDefault?, overrides: [{method, minutes}] } or a bare overrides array. */
function readReminders(value: unknown): CalendarEventInput['reminders'] {
  if (value == null) return null;
  const raw = Array.isArray(value) ? { useDefault: false, overrides: value } : (value as { useDefault?: unknown; overrides?: unknown });
  if (raw.useDefault === true) return { useDefault: true, overrides: [] };
  const overrides: CalendarReminder[] = (Array.isArray(raw.overrides) ? raw.overrides : [])
    .map((o: { method?: unknown; minutes?: unknown }) => ({
      method: o?.method === 'email' ? ('email' as const) : ('popup' as const),
      minutes: Math.round(Number(o?.minutes)),
    }))
    .filter((o: CalendarReminder) => Number.isFinite(o.minutes) && o.minutes >= 0 && o.minutes <= 40320)
    .slice(0, 5);
  return { useDefault: false, overrides };
}

/** Drive attachments: [{ fileUrl? | fileId?, title?, mimeType? }]. A bare fileId becomes its Drive URL. */
function readAttachments(value: unknown): CalendarAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: CalendarAttachment[] = [];
  for (const item of value) {
    const row = (item || {}) as Record<string, unknown>;
    const fileId = String(row.fileId || row.driveFileId || '').trim();
    let fileUrl = String(row.fileUrl || row.url || '').trim();
    if (!fileUrl && DRIVE_ID.test(fileId)) fileUrl = `https://drive.google.com/open?id=${fileId}`;
    if (!/^https:\/\//i.test(fileUrl)) continue;
    out.push({
      fileUrl: fileUrl.slice(0, 1000),
      fileId: DRIVE_ID.test(fileId) ? fileId : '',
      title: String(row.title || row.name || '').slice(0, 200),
      mimeType: String(row.mimeType || '').slice(0, 120),
    });
  }
  return out.slice(0, 25);
}

/** extendedProperties.private: flat string map (Google caps keys at 44 and values at 1024 chars). */
function readPrivateProps(value: unknown) {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    const k = String(key).slice(0, 44);
    if (k) out[k] = String(val ?? '').slice(0, 1024);
  }
  return out;
}

const CLEARABLE = ['attendees', 'location', 'description', 'attachments'] as const;

/**
 * Editor fields present in the body. Absent keys stay undefined, so PATCH leaves them alone.
 * On PATCH an empty attendees/location/description/attachments value is treated as "not sent" unless
 * the key is listed in body.clear (e.g. clear: ['attendees']). The editor resends every field on a
 * drag, and an empty value there must never strip guests or notes from a real meeting.
 */
function readEditorFields(body: Record<string, unknown>, mode: 'create' | 'patch'): CalendarEventInput {
  const input: CalendarEventInput = {};
  if (has(body, 'attendees')) input.attendees = readAttendees(body.attendees);
  if (has(body, 'location')) input.location = String(body.location ?? '').slice(0, 500);
  if (has(body, 'description')) input.description = String(body.description ?? '').slice(0, 4000);
  if (has(body, 'reminders')) input.reminders = readReminders(body.reminders);
  if (has(body, 'attachments')) input.attachments = readAttachments(body.attachments);
  const ext = body.extendedProperties as { private?: unknown } | undefined;
  if (ext && typeof ext === 'object' && has(ext as Record<string, unknown>, 'private')) input.privateProps = readPrivateProps(ext.private);
  if (mode === 'patch') {
    const clear = new Set((Array.isArray(body.clear) ? body.clear : []).map((k) => String(k)));
    for (const key of CLEARABLE) {
      const value = input[key];
      if (value !== undefined && value.length === 0 && !clear.has(key)) delete input[key];
    }
  }
  return input;
}

/** Email guests only when the event has guests. Unknown (cached before attendees were kept) → notify. */
function eventHasGuests(cached: CalEvent | undefined, input: CalendarEventInput) {
  if (input.attendees !== undefined && input.attendees.length) return true;
  if (!cached) return true;
  return cached.attendees === undefined ? true : cached.attendees.length > 0;
}

/**
 * C22: calendarId from the editor. '' or the source calendar = the normal path. Another calendar must be writable
 * in the user's calendarList; returns { id, color } or an error response.
 */
async function targetCalendar(body: Record<string, unknown>) {
  const raw = String(body.calendarId || '').trim();
  if (!raw) return { id: '', color: '' };
  if (!CAL_ID.test(raw)) return { error: NextResponse.json({ error: 'That calendar is not valid.' }, { status: 400 }) };
  if (await isSourceCalendar(raw)) return { id: '', color: '' };
  const cal = await writableCalendar(raw);
  if (!cal) return { error: NextResponse.json({ error: 'You cannot add events to that calendar.' }, { status: 403 }) };
  return { id: cal.id, color: cal.color };
}

/** Signed-in, allowlisted caller (see sessionOwner). */
async function calendarSession() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session, ownerId };
}

export async function GET(req: Request) {
  try {
    const gate = await calendarSession();
    if ('error' in gate) return gate.error;
    const { session, ownerId } = gate;
    if (!session.sql) return NextResponse.json({ events: [], calendarUntil: 0 });
    const url = new URL(req.url);
    const parsedFrom = Date.parse(url.searchParams.get('from') || '');
    const parsedTo = Date.parse(url.searchParams.get('to') || '');
    const from = Number.isFinite(parsedFrom) ? parsedFrom : Date.now() - 24 * 60 * 60 * 1000;
    const to = Number.isFinite(parsedTo) ? parsedTo : Date.now() + 14 * 24 * 60 * 60 * 1000;
    const creds = await loadCredsFor(session.userId);
    const result = await withCreds(creds, () => extendCalendar(session.sql!, ownerId, from, to));
    if (!result.ok) {
      const cached = await calendarPayload(session.sql, ownerId);
      return NextResponse.json({
        events: shapeEvents(cached),
        calendarUntil: 0,
        error: cached.length ? '' : 'Calendar could not be read.',
      });
    }
    return NextResponse.json({ events: shapeEvents(result.events), calendarUntil: result.until });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ events: [], calendarUntil: 0, error: 'Calendar could not be read.' }, { status: 500 });
  }
}

/**
 * Create (no id, with title) or move (id + start).
 * Body: { id?, start: ms, dur?: minutes, title?, attendees?: string[], location?, description?,
 *         reminders?: { useDefault?, overrides: [{ method: 'popup'|'email', minutes }] },
 *         attachments?: [{ fileUrl? | fileId?, title?, mimeType? }], extendedProperties?: { private: {} } }
 * Times are written with timeZone America/Vancouver; guests are emailed only when there are attendees.
 */
export async function POST(req: Request) {
  try {
    const gate = await calendarSession();
    if ('error' in gate) return gate.error;
    const { session, ownerId } = gate;
    if (!session.sql) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 503 });
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const id = String(body.id || '');
    const start = Number(body.start);
    const dur = Math.max(15, Math.min(Number(body.dur) || 30, 24 * 60));
    const title = String(body.title || '').trim().slice(0, 180);
    if (!Number.isFinite(start)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 429 });
    }
    const creds = await loadCredsFor(session.userId);
    const target = await withCreds(creds, () => targetCalendar(body));
    if ('error' in target) return target.error;
    if (!id && title) {
      const input = readEditorFields(body, 'create');
      const created = target.id
        ? await withCreds(creds, () => createOnCalendar(target.id, start, dur, title, input))
        : await withCreds(creds, () => createEvent(start, dur, title, input));
      if (!created) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 502 });
      return NextResponse.json({
        id: created,
        calendarId: target.id || sourceCalendarId(),
        ...(target.color ? { color: target.color } : {}),
        start,
        dur,
        title,
        timeZone: CALENDAR_TIME_ZONE,
        attendees: input.attendees || [],
        location: input.location || '',
        description: input.description || '',
        reminders: input.reminders || null,
        attachments: input.attachments || [],
        extendedProperties: { private: input.privateProps || {} },
      });
    }
    if (!EVENT_ID.test(id)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const events = await calendarPayload(session.sql, ownerId);
    const current = events.find((event) => event.id === id);
    const length = current?.dur || dur;
    const moved = await withCreds(creds, () => moveEvent(id, start, length, eventHasGuests(current, {})));
    if (!moved) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 502 });
    if (target.id) {
      const shifted = await withCreds(creds, () => moveToCalendar(sourceCalendarId(), id, target.id));
      if (!shifted) return NextResponse.json({ error: 'The time moved, but Google would not move it to that calendar.' }, { status: 502 });
      return NextResponse.json({ id, start, calendarId: target.id, color: target.color });
    }
    const next = events.map((event) => (event.id === id ? { ...event, start } : event));
    await session.sql`
      INSERT INTO calendar_cache (owner_id, events, fetched_at)
      VALUES (${ownerId}, ${JSON.stringify(next)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET events = EXCLUDED.events, fetched_at = now()
    `;
    return NextResponse.json({ id, start });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 500 });
  }
}

/**
 * Edit an event. Only keys present in the body change (same fields as POST, plus action:'decline').
 * Empty attendees/location/description/attachments are ignored unless named in clear: [...].
 */
export async function PATCH(req: Request) {
  try {
    const gate = await calendarSession();
    if ('error' in gate) return gate.error;
    const { session, ownerId } = gate;
    if (!session.sql) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 503 });
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const id = String(body.id || '');
    if (!EVENT_ID.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 429 });
    }
    const creds = await loadCredsFor(session.userId);
    const start = Number(body.start);
    const dur = Math.max(15, Math.min(Number(body.dur) || 30, 24 * 60));
    const title = String(body.title || '').trim().slice(0, 180);
    const input = readEditorFields(body, 'patch');
    const fields: Record<string, unknown> = {};
    if (Number.isFinite(start)) {
      const begin = new Date(start);
      const end = new Date(start + dur * 60 * 1000);
      fields.start = { dateTime: begin.toISOString(), timeZone: CALENDAR_TIME_ZONE };
      fields.end = { dateTime: end.toISOString(), timeZone: CALENDAR_TIME_ZONE };
    }
    if (title) fields.summary = title;
    const target = await withCreds(creds, () => targetCalendar(body));
    if ('error' in target) return target.error;
    const cached = (await calendarPayload(session.sql, ownerId)).find((event) => event.id === id);
    const patched = String(body.action || '') === 'decline'
      ? await withCreds(creds, () => declineCalendarEvent(id, ROOM_EMAIL))
      : await withCreds(creds, () => patchCalendarEvent(id, fields, input, eventHasGuests(cached, input)));
    if (!patched) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 502 });
    if (target.id) {
      const shifted = await withCreds(creds, () => moveToCalendar(sourceCalendarId(), id, target.id));
      if (!shifted) return NextResponse.json({ error: 'Saved, but Google would not move it to that calendar.' }, { status: 502 });
    }
    return NextResponse.json({
      id,
      ...(target.id ? { calendarId: target.id, color: target.color, moved: true } : {}),
      start: Number.isFinite(start) ? start : undefined,
      dur,
      title,
      timeZone: CALENDAR_TIME_ZONE,
      ...(input.attendees !== undefined ? { attendees: input.attendees } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.reminders !== undefined ? { reminders: input.reminders } : {}),
      ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
      ...(input.privateProps !== undefined ? { extendedProperties: { private: input.privateProps } } : {}),
    });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await calendarSession();
    if ('error' in gate) return gate.error;
    const { session } = gate;
    if (!session.sql) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 503 });
    const url = new URL(req.url);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const id = String(body?.id || url.searchParams.get('id') || '');
    if (!EVENT_ID.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!(await claimBudget(session.sql, session.userId, 'google_calendar', 1))) {
      return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 429 });
    }
    const creds = await loadCredsFor(session.userId);
    const gone = await withCreds(creds, () => deleteCalendarEvent(id));
    if (!gone) return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 502 });
    return NextResponse.json({ id, deleted: true });
  } catch (err) {
    fail('calendar_failed', err);
    return NextResponse.json({ error: 'Calendar could not be updated.' }, { status: 500 });
  }
}
