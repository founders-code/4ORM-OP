import type { NeonQueryFunction } from '@neondatabase/serverless';
import { withCreds } from './creds';
import { fail } from './log';
import { createInviteEvent, listEvents } from './google';
import { ensureGhlContact, pushOpportunity, sendViaGhl } from './ghl';
import { createZoomMeeting } from './zoom';
import { loadCredsFor } from './vault';
import { openSlots } from './slots.mjs';

type Sql = NeonQueryFunction<false, false>;

const CAP = 6;
const BUFFER_MS = 15 * 60 * 1000;
const FOCUS_HOUR = 9;

function laParts(ms: number) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  return bag;
}

function isFocusBlock(ms: number) {
  const p = laParts(ms);
  const hour = Number(p.hour);
  const weekday = p.weekday;
  return weekday !== 'Sat' && weekday !== 'Sun' && hour === FOCUS_HOUR;
}

export async function bookSlots(sql: Sql, ownerId: string, minutes: number, fromMs = Date.now()) {
  const dur = minutes === 15 || minutes === 60 ? minutes : 30;
  let busy: Array<{ start: number; end: number }> = [];
  try {
    const creds = await loadCredsFor(ownerId);
    const listed = await withCreds(creds, () => listEvents(new Date(fromMs).toISOString(), new Date(fromMs + 21 * 86400000).toISOString()));
    busy = (listed?.events || []).flatMap((event) => event ? [{
      start: Number(event.start) - BUFFER_MS,
      end: Number(event.start) + Number(event.dur || dur) * 60000 + BUFFER_MS,
    }] : []);
  } catch (err) {
    fail('book_busy', err);
  }
  try {
    const taken = await sql`
      SELECT start_at, end_at FROM bookings
      WHERE owner_id = ${ownerId} AND status = 'booked' AND start_at >= now()
    `;
    for (const row of taken as Array<{ start_at?: string; end_at?: string }>) {
      busy.push({ start: Date.parse(String(row.start_at)) - BUFFER_MS, end: Date.parse(String(row.end_at)) + BUFFER_MS });
    }
  } catch (err) {
    fail('book_taken', err);
  }
  const raw = openSlots(fromMs, busy, 14);
  const byDay: Record<string, number> = {};
  const out = [];
  for (const slot of raw) {
    if (!slot.free) continue;
    if (isFocusBlock(slot.start)) continue;
    const end = slot.start + dur * 60 * 1000;
    const hit = busy.some((row) => slot.start < row.end && end > row.start);
    if (hit) continue;
    const day = slot.day;
    byDay[day] = (byDay[day] || 0) + 1;
    if (byDay[day] > CAP) continue;
    out.push({ start: slot.start, end, day, label: slot.label });
  }
  return { minutes: dur, slots: out.slice(0, 80) };
}

function topicLane(topics: string) {
  const text = String(topics || '').toLowerCase();
  if (/invest/.test(text)) return { type: 'vc', stage: 'meeting', name: 'Investor booking' };
  if (/design|partner|broker/.test(text)) return { type: 'business', stage: 'meeting', name: 'Design-partner booking' };
  return { type: 'other', stage: 'meeting', name: 'Booking' };
}

export async function takeBooking(sql: Sql, ownerId: string, input: {
  name: string;
  email: string;
  topics?: string;
  notes?: string;
  start: number;
  minutes?: number;
  tz?: string;
}) {
  const name = String(input.name || '').trim().slice(0, 120);
  const email = String(input.email || '').trim().toLowerCase().slice(0, 180);
  const start = Number(input.start);
  const minutes = input.minutes === 15 || input.minutes === 60 ? input.minutes : 30;
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isFinite(start) || start < Date.now() - 60000) {
    return { ok: false as const, error: 'That slot could not be booked.' };
  }
  const open = await bookSlots(sql, ownerId, minutes, Date.now() - 60000);
  const slot = open.slots.find((row) => Math.abs(row.start - start) < 60000);
  if (!slot) return { ok: false as const, error: 'That time is no longer open.' };
  const end = slot.start + minutes * 60 * 1000;
  const topics = String(input.topics || '').slice(0, 200);
  const notes = String(input.notes || '').slice(0, 800);
  const tz = String(input.tz || 'America/Los_Angeles').slice(0, 80);
  let zoom = '';
  try {
    zoom = (await createZoomMeeting(new Date(slot.start).toISOString(), minutes, `4orm - ${name}`)) || '';
  } catch (err) {
    fail('book_zoom', err);
  }
  let gcal = '';
  let join = zoom;
  try {
    const creds = await loadCredsFor(ownerId);
    const created = await withCreds(creds, () => createInviteEvent({
      startMs: slot.start,
      durMin: minutes,
      title: `Chad Johnston / ${name}`,
      attendee: email,
      description: [`Topics: ${topics || 'open'}`, notes, zoom ? `Zoom: ${zoom}` : ''].filter(Boolean).join('\n'),
      location: zoom || '',
    }));
    if (created?.id) gcal = created.id;
    if (created?.join && !join) join = created.join;
  } catch (err) {
    fail('book_gcal', err);
  }
  try {
    await sql`
      INSERT INTO bookings (owner_id, name, email, topics, notes, start_at, end_at, tz, zoom_url, gcal_event_id, status)
      VALUES (${ownerId}, ${name}, ${email}, ${topics}, ${notes}, ${new Date(slot.start).toISOString()}::timestamptz, ${new Date(end).toISOString()}::timestamptz, ${tz}, ${join}, ${gcal}, 'booked')
    `;
  } catch (err) {
    fail('book_save', err);
  }
  try {
    await sql`
      INSERT INTO contacts (owner_id, name, email, notes, source, type, stage, category, last_touch)
      VALUES (${ownerId}, ${name}, ${email}, ${notes || topics}, 'booking', ${topicLane(topics).type}, 'meeting', ${/invest/.test(topics.toLowerCase()) ? 'vc' : (/design|partner/.test(topics.toLowerCase()) ? 'business' : 'other')}, now())
    `;
  } catch (err) {
    fail('book_contact', err);
  }
  try {
    const creds = await loadCredsFor(ownerId);
    await withCreds(creds, async () => {
      const contactId = await ensureGhlContact({ name, email });
      if (contactId) {
        const lane = topicLane(topics);
        await pushOpportunity({ name: `${lane.name} - ${name}`, contactId, stage: 'meeting' }).catch(() => '');
        const when = new Date(slot.start).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        await sendViaGhl({
          contactId,
          email,
          subject: `Confirmed - ${minutes}-minute call with Chad Johnston`,
          html: `<p>Looking forward to connecting, ${name.split(' ')[0]}.</p><p>${when} (${tz.replace(/_/g, ' ')}).</p>${join ? `<p>Join: <a href="${join}">${join}</a></p>` : ''}<p>To reschedule or cancel, reply to this note.</p>`,
        });
      }
    });
  } catch (err) {
    fail('book_ghl', err);
  }
  return { ok: true as const, start: slot.start, end, zoom: join, tz };
}
