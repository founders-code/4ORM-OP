import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import type { ZoomMail } from './google';

type Sql = NeonQueryFunction<false, false>;

type Note = {
  noteId: string;
  date: string;
  title: string;
  attendees: string[];
  solo: boolean;
  others: string[];
  intel: { label: string; value: string }[];
  sources: { name: string; url: string | null }[];
};

type RecordingFile = { file_type?: string; download_url?: string; status?: string };
type Meeting = { uuid?: string; topic?: string; start_time?: string; recording_files?: RecordingFile[] };

const DAYS_BACK = 90;
const NEW_PER_REFRESH = 25;

export function zoomConfigured() {
  return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

let cached: { token: string; until: number } | null = null;

async function zoomToken() {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const id = process.env.ZOOM_CLIENT_ID || '';
  const secret = process.env.ZOOM_CLIENT_SECRET || '';
  const account = process.env.ZOOM_ACCOUNT_ID || '';
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(account)}`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return '';
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!json?.access_token) return '';
  cached = { token: json.access_token, until: Date.now() + (json.expires_in || 3000) * 1000 };
  return cached.token;
}

async function zget<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(9000),
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

function zoomUser() {
  return encodeURIComponent(process.env.ZOOM_USER || 'me');
}

/** Meeting UUIDs that start with "/" or contain "//" must be double-encoded in the path. */
function uuidPath(uuid: string) {
  return uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(encodeURIComponent(uuid)) : encodeURIComponent(uuid);
}

function day(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Every cloud recording in the window. Zoom caps one query at 30 days, so walk month windows and follow every page. */
async function listMeetings(token: string) {
  const out = new Map<string, Meeting>();
  const now = Date.now();
  for (let back = 0; back < DAYS_BACK; back += 30) {
    const to = day(now - back * 86400000 + 86400000);
    const from = day(now - Math.min(back + 30, DAYS_BACK) * 86400000);
    let page = '';
    for (let i = 0; i < 10; i += 1) {
      const q = new URLSearchParams({ from, to, page_size: '300' });
      if (page) q.set('next_page_token', page);
      const json = await zget<{ meetings?: Meeting[]; next_page_token?: string }>(token, `/users/${zoomUser()}/recordings?${q}`);
      if (!json) {
        if (!back && !i) return null;
        break;
      }
      for (const meeting of json.meetings || []) if (meeting.uuid && !out.has(meeting.uuid)) out.set(meeting.uuid, meeting);
      page = json.next_page_token || '';
      if (!page) break;
    }
  }
  return [...out.values()].sort((a, b) => Date.parse(b.start_time || '') - Date.parse(a.start_time || ''));
}

/** Speaker turns from a WebVTT transcript, consecutive turns by the same speaker merged. */
export function parseTranscript(vtt: string) {
  const turns: { who: string; text: string }[] = [];
  for (const block of vtt.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter((line) => line && !/-->/.test(line) && !/^\d+$/.test(line) && line !== 'WEBVTT');
    if (!lines.length) continue;
    const joined = lines.join(' ');
    const hit = joined.match(/^([^:]{1,60}):\s*(.+)$/);
    const who = hit ? hit[1].trim() : '';
    const text = (hit ? hit[2] : joined).trim();
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.who === who) last.text = `${last.text} ${text}`;
    else turns.push({ who, text });
  }
  return turns;
}

function selfNames(display: string) {
  const names = new Set<string>();
  const clean = display.trim().toLowerCase();
  if (clean) {
    names.add(clean);
    names.add(clean.split(/\s+/)[0]);
  }
  return names;
}

function isSelf(who: string, self: Set<string>) {
  const name = who.trim().toLowerCase();
  return !!name && (self.has(name) || self.has(name.split(/\s+/)[0]));
}

/** Only what the other participants said, in their own words. Never the owner's lines. */
export function othersFrom(turns: { who: string; text: string }[], self: Set<string>) {
  return turns
    .filter((turn) => turn.who && !isSelf(turn.who, self) && turn.text.length >= 40)
    .map((turn) => `${turn.who}: ${turn.text.length > 420 ? `${turn.text.slice(0, 417)}...` : turn.text}`)
    .slice(0, 40);
}

async function meetingNote(token: string, meeting: Meeting, self: Set<string>): Promise<Note | null> {
  const uuid = String(meeting.uuid || '');
  if (!uuid) return null;
  const transcript = (meeting.recording_files || []).find((file) => file.file_type === 'TRANSCRIPT' && file.download_url);
  let turns: { who: string; text: string }[] = [];
  if (transcript?.download_url) {
    const res = await fetch(transcript.download_url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(9000),
    }).catch(() => null);
    if (res?.ok) turns = parseTranscript((await res.text().catch(() => '')).slice(0, 400000));
  }
  const summary = await zget<{ summary_overview?: string; summary_details?: Array<{ label?: string; summary?: string }>; next_steps?: string[] }>(
    token,
    `/meetings/${uuidPath(uuid)}/meeting_summary`,
  );
  const intel: { label: string; value: string }[] = [];
  if (summary?.summary_overview) intel.push({ label: 'Zoom summary', value: summary.summary_overview.slice(0, 1500) });
  for (const row of summary?.summary_details || []) {
    if (row.summary) intel.push({ label: String(row.label || 'Detail').slice(0, 120), value: row.summary.slice(0, 1500) });
  }
  if (summary?.next_steps?.length) intel.push({ label: 'Next steps', value: summary.next_steps.join(' | ').slice(0, 1500) });
  const speakers = [...new Set(turns.map((turn) => turn.who).filter(Boolean))];
  const others = othersFrom(turns, self);
  return {
    noteId: uuid,
    date: (meeting.start_time || new Date().toISOString()).slice(0, 10),
    title: String(meeting.topic || 'Zoom meeting').slice(0, 180),
    attendees: speakers.slice(0, 20),
    solo: !!turns.length && speakers.every((who) => isSelf(who, self)),
    others,
    intel: intel.slice(0, 12),
    sources: [{ name: 'Zoom cloud recording', url: null }],
  };
}

/** Zoom emails a meeting summary. Title and date come from the subject; the body is kept as the recap. */
export function mailNote(mail: ZoomMail): Note | null {
  const subject = mail.subject.replace(/\s+/g, ' ').trim();
  if (!/summary|transcript|recording|assets/i.test(subject)) return null;
  const dated = subject.match(/\((\d{1,2})\/(\d{1,2})\/(\d{4})\)/);
  const date = dated ? `${dated[3]}-${dated[1].padStart(2, '0')}-${dated[2].padStart(2, '0')}` : day(mail.at);
  const title = subject
    .replace(/^(?:fwd?:\s*)?(?:meeting summary(?: with ai companion)? for|meeting assets for|audio transcript for|cloud recording\s*-)\s*/i, '')
    .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{4}\)\s*/, ' ')
    .replace(/\s*(?:are ready!?|is now available\.?)\s*$/i, '')
    .trim()
    .slice(0, 180) || 'Zoom meeting';
  const lines = mail.text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^https?:\/\//i.test(line) && !/unsubscribe|privacy|copyright|zoom video communications|view in browser|ai-generated content may be inaccurate/i.test(line));
  const split = lines.findIndex((line) => /^next steps\b/i.test(line));
  const recap = (split >= 0 ? lines.slice(0, split) : lines).join(' ').slice(0, 1500);
  const next = split >= 0 ? lines.slice(split + 1).join(' | ').slice(0, 1500) : '';
  const intel: { label: string; value: string }[] = [];
  if (recap) intel.push({ label: 'Zoom summary', value: recap });
  if (next) intel.push({ label: 'Next steps', value: next });
  return { noteId: `gmail-${mail.id}`, date, title, attendees: [], solo: false, others: [], intel, sources: [{ name: 'Zoom summary email', url: null }] };
}

let syncTable: Promise<boolean> | null = null;

function ensureSyncTable(sql: Sql) {
  if (!syncTable) {
    syncTable = (async () => {
      try {
        await sql`CREATE TABLE IF NOT EXISTS zoom_syncs (owner_id text PRIMARY KEY, synced_at timestamptz NOT NULL DEFAULT now())`;
        return true;
      } catch (err) {
        fail('zoom_syncs_table', err);
        syncTable = null;
        return false;
      }
    })();
  }
  return syncTable;
}

export async function lastZoomSync(sql: Sql, ownerId: string) {
  if (!(await ensureSyncTable(sql))) return 0;
  try {
    const rows = await sql`SELECT synced_at FROM zoom_syncs WHERE owner_id = ${ownerId} LIMIT 1`;
    return rows[0]?.synced_at ? new Date(String(rows[0].synced_at)).getTime() : 0;
  } catch (err) {
    fail('zoom_syncs_read', err);
    return 0;
  }
}

async function markZoomSync(sql: Sql, ownerId: string) {
  if (!(await ensureSyncTable(sql))) return;
  try {
    await sql`
      INSERT INTO zoom_syncs (owner_id, synced_at) VALUES (${ownerId}, now())
      ON CONFLICT (owner_id) DO UPDATE SET synced_at = EXCLUDED.synced_at
    `;
  } catch (err) {
    fail('zoom_syncs_write', err);
  }
}

/** Note ids already holding content. Empty rows from an earlier pass are refilled once the transcript lands. */
export async function filledZoomIds(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT note_id FROM zoom_notes
    WHERE owner_id = ${ownerId} AND (others <> '[]'::jsonb OR intel <> '[]'::jsonb OR note_id LIKE 'gmail-%')
  `;
  return new Set(rows.map((row) => String(row.note_id)));
}

async function saveNote(sql: Sql, ownerId: string, note: Note) {
  const rows = await sql`
    INSERT INTO zoom_notes (owner_id, note_id, note_date, title, attendees, solo, others, intel, improve, sources)
    SELECT ${ownerId}, ${note.noteId}, ${note.date}::date, ${note.title}, ${JSON.stringify(note.attendees)}::jsonb, ${note.solo},
           ${JSON.stringify(note.others)}::jsonb, ${JSON.stringify(note.intel)}::jsonb, '[]'::jsonb, ${JSON.stringify(note.sources)}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM zoom_notes z
      WHERE z.owner_id = ${ownerId} AND z.note_id <> ${note.noteId}
        AND z.note_date = ${note.date}::date AND lower(z.title) = lower(${note.title})
    )
    ON CONFLICT (owner_id, note_id) DO UPDATE SET
      attendees = EXCLUDED.attendees,
      solo = EXCLUDED.solo,
      others = EXCLUDED.others,
      intel = EXCLUDED.intel,
      sources = EXCLUDED.sources
    WHERE zoom_notes.others = '[]'::jsonb AND zoom_notes.intel = '[]'::jsonb
    RETURNING (xmax = 0) AS inserted
  `;
  if (!rows.length) return 'kept' as const;
  return rows[0]?.inserted ? ('added' as const) : ('filled' as const);
}

export type ZoomSyncResult = { added: number; filled: number; seen: number; zoom: 'connected' | 'not_connected' | 'unavailable' };

/** Pull every recent Zoom recording, transcript, and summary not yet on the desk. */
export async function syncZoomApi(sql: Sql, ownerId: string, known: Set<string>): Promise<ZoomSyncResult> {
  const result: ZoomSyncResult = { added: 0, filled: 0, seen: 0, zoom: 'not_connected' };
  if (!zoomConfigured()) return result;
  const token = await zoomToken();
  if (!token) return { ...result, zoom: 'unavailable' };
  const meetings = await listMeetings(token);
  if (!meetings) return { ...result, zoom: 'unavailable' };
  result.zoom = 'connected';
  result.seen = meetings.length;
  const me = await zget<{ display_name?: string; first_name?: string; last_name?: string }>(token, `/users/${zoomUser()}`);
  const self = selfNames(me?.display_name || [me?.first_name, me?.last_name].filter(Boolean).join(' '));
  const todo = meetings.filter((meeting) => meeting.uuid && !known.has(meeting.uuid)).slice(0, NEW_PER_REFRESH);
  for (let i = 0; i < todo.length; i += 5) {
    const notes = await Promise.all(todo.slice(i, i + 5).map((meeting) => meetingNote(token, meeting, self).catch(() => null)));
    for (const note of notes) {
      if (!note) continue;
      const saved = await saveNote(sql, ownerId, note).catch((err) => {
        fail('zoom_save', err);
        return 'kept' as const;
      });
      if (saved === 'added') result.added += 1;
      if (saved === 'filled') result.filled += 1;
    }
  }
  await markZoomSync(sql, ownerId);
  return result;
}

export async function saveMailNotes(sql: Sql, ownerId: string, mails: ZoomMail[]) {
  let added = 0;
  for (const mail of mails) {
    const note = mailNote(mail);
    if (!note) continue;
    const saved = await saveNote(sql, ownerId, note).catch((err) => {
      fail('zoom_mail_save', err);
      return 'kept' as const;
    });
    if (saved === 'added') added += 1;
  }
  return added;
}
