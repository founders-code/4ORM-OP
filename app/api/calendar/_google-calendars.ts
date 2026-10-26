import { CALENDAR_TIME_ZONE, type CalendarEventInput, googleAccessToken } from '@/lib/google';

/**
 * C22: the user's Google calendars (calendarList) and writes to a chosen calendar.
 * The app reads events from one calendar (GOOGLE_CALENDAR_ID or primary); this file lets a new event be created on
 * another writable calendar, and an existing event be moved there (Google events.move).
 */
export const CAL_ID = /^[\w.@#+-]{1,200}$/;

export function sourceCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

async function call(url: string, init: { method?: string; body?: string } = {}) {
  const access = await googleAccessToken();
  if (!access) return { ok: false, status: 0, json: null as unknown };
  const res = await fetch(url, {
    method: init.method || 'GET',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: init.body,
    signal: AbortSignal.timeout(12000),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export type GoogleCalendar = { id: string; name: string; color: string; primary: boolean; writable: boolean; source: boolean };

export async function listCalendars(): Promise<GoogleCalendar[] | null> {
  const r = await call('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=100');
  if (!r.ok) return null;
  const items = ((r.json as { items?: Array<Record<string, unknown>> } | null)?.items || []);
  const src = sourceCalendarId();
  const out = items
    .filter((c) => c.id && !c.deleted && c.hidden !== true)
    .map((c) => {
      const id = String(c.id);
      const role = String(c.accessRole || '');
      return {
        id,
        name: String(c.summaryOverride || c.summary || id).slice(0, 120),
        color: /^#[0-9a-f]{6}$/i.test(String(c.backgroundColor || '')) ? String(c.backgroundColor) : '#2e6bf2',
        primary: c.primary === true,
        writable: role === 'owner' || role === 'writer',
        source: id === src || (src === 'primary' && c.primary === true),
      };
    });
  out.sort((a, b) => Number(b.source) - Number(a.source) || Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
  return out;
}

/** The id the source calendar has in calendarList (so 'primary' compares equal to the real address). */
export async function isSourceCalendar(id: string) {
  const src = sourceCalendarId();
  if (!id || id === src) return true;
  if (src === 'primary') {
    const list = await listCalendars();
    return !!list?.find((c) => c.id === id && c.primary);
  }
  return false;
}

export async function writableCalendar(id: string) {
  if (!CAL_ID.test(id)) return null;
  const list = await listCalendars();
  return list?.find((c) => c.id === id && c.writable) || null;
}

function eventBody(input: CalendarEventInput) {
  const body: Record<string, unknown> = {};
  if (input.location !== undefined) body.location = input.location.slice(0, 500);
  if (input.description !== undefined) body.description = input.description.slice(0, 4000);
  if (input.attendees !== undefined) body.attendees = input.attendees.map((email) => ({ email }));
  if (input.reminders) body.reminders = input.reminders;
  if (input.attachments !== undefined) body.attachments = input.attachments.map((a) => ({ fileUrl: a.fileUrl, title: a.title || undefined, mimeType: a.mimeType || undefined }));
  if (input.privateProps !== undefined) body.extendedProperties = { private: input.privateProps };
  return body;
}

/** Create on a specific calendar. Guests are emailed only when there are guests. Returns the event id or null. */
export async function createOnCalendar(calendarId: string, startMs: number, durMin: number, title: string, input: CalendarEventInput) {
  const q = new URLSearchParams({ sendUpdates: input.attendees?.length ? 'all' : 'none' });
  if (input.attachments?.length) q.set('supportsAttachments', 'true');
  const r = await call(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`, {
    method: 'POST',
    body: JSON.stringify({
      summary: String(title || 'New event').slice(0, 180),
      start: { dateTime: new Date(startMs).toISOString(), timeZone: CALENDAR_TIME_ZONE },
      end: { dateTime: new Date(startMs + durMin * 60000).toISOString(), timeZone: CALENDAR_TIME_ZONE },
      ...eventBody(input),
    }),
  });
  const id = (r.json as { id?: string } | null)?.id;
  return r.ok && id ? String(id) : null;
}

/** Move an event from one calendar to another (no guest emails). */
export async function moveToCalendar(fromId: string, eventId: string, toId: string) {
  const r = await call(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(fromId)}/events/${encodeURIComponent(eventId)}/move?destination=${encodeURIComponent(toId)}&sendUpdates=none`,
    { method: 'POST' },
  );
  return r.ok;
}
