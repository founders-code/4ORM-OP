/**
 * Zoom My Notes (28 Oct 2026). Zoom keeps AI Companion transcripts in My Notes, which only a user-signed app can read.
 * Chad signs in once (/api/connect/zoom). The token pair is sealed (AES-256-GCM) in zoom_oauth, never in Clerk.
 * Each sync lists his past meetings, finds the My Notes for each, and lands transcript, recap and next steps as a Zoom note.
 */
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { fail } from './log';
import { outbound } from './outbound';
import { openSeal, seal } from './seal.mjs';
import { othersFrom } from './zoom';

type Sql = NeonQueryFunction<false, false>;
type Tokens = { access: string; refresh: string; until: number };
type Turn = { who: string; text: string };

const DAYS_BACK = 60;
/* Each new note costs one summary call (about 10 s); keep a run inside the 60 s function limit. */
const PER_SYNC = 4;
export let notesError = '';

function material() {
  return process.env.ENCRYPTION_KEY || process.env.CLERK_SECRET_KEY || '';
}

export function zoomNotesConfigured() {
  return !!(env('ZOOM_OAUTH_CLIENT_ID') && env('ZOOM_OAUTH_CLIENT_SECRET'));
}

function basic() {
  return `Basic ${Buffer.from(`${env('ZOOM_OAUTH_CLIENT_ID')}:${env('ZOOM_OAUTH_CLIENT_SECRET')}`).toString('base64')}`;
}

let table: Promise<boolean> | null = null;
function ensureTable(sql: Sql) {
  if (!table) {
    table = (async () => {
      try {
        await sql`CREATE TABLE IF NOT EXISTS zoom_oauth (owner_id text PRIMARY KEY, sealed text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
        return true;
      } catch (err) {
        fail('zoom_oauth_table', err);
        table = null;
        return false;
      }
    })();
  }
  return table;
}

async function saveTokens(sql: Sql, ownerId: string, t: Tokens) {
  if (!(await ensureTable(sql))) return false;
  const packed = seal(JSON.stringify(t), material());
  if (!packed) return false;
  await sql`
    INSERT INTO zoom_oauth (owner_id, sealed, updated_at) VALUES (${ownerId}, ${packed}, now())
    ON CONFLICT (owner_id) DO UPDATE SET sealed = EXCLUDED.sealed, updated_at = now()
  `;
  return true;
}

async function loadTokens(sql: Sql, ownerId: string): Promise<Tokens | null> {
  if (!(await ensureTable(sql))) return null;
  const rows = await sql`SELECT sealed FROM zoom_oauth WHERE owner_id = ${ownerId} LIMIT 1`;
  const plain = rows[0]?.sealed ? openSeal(String(rows[0].sealed), material()) : null;
  if (!plain) return null;
  try {
    return JSON.parse(plain) as Tokens;
  } catch {
    return null;
  }
}

export async function zoomNotesConnected(sql: Sql, ownerId: string) {
  return !!(await loadTokens(sql, ownerId).catch(() => null));
}

async function tokenCall(params: Record<string, string>) {
  const res = await outbound('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(9000),
  }).catch(() => null);
  const json = res ? ((await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; reason?: string; error?: string } | null) : null;
  if (!res?.ok || !json?.access_token || !json.refresh_token) {
    notesError = `token ${res ? res.status : 'no response'} ${json?.reason || json?.error || ''}`.trim();
    return null;
  }
  return { access: json.access_token, refresh: json.refresh_token, until: Date.now() + (json.expires_in || 3600) * 1000 };
}

/** The sign-in callback: swap the code for a token pair and seal it. */
export async function connectZoomNotes(sql: Sql, ownerId: string, code: string, redirectUri: string) {
  const t = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  return t ? saveTokens(sql, ownerId, t) : false;
}

async function accessToken(sql: Sql, ownerId: string) {
  const t = await loadTokens(sql, ownerId);
  if (!t) {
    notesError = 'not signed in';
    return '';
  }
  if (t.until > Date.now() + 120_000) return t.access;
  const next = await tokenCall({ grant_type: 'refresh_token', refresh_token: t.refresh });
  if (!next) return '';
  await saveTokens(sql, ownerId, next);
  return next.access;
}

async function zget<T>(token: string, path: string): Promise<{ ok: boolean; status: number; json: T | null }> {
  const res = await outbound(`https://api.zoom.us/v2${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, json: null };
  const json = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, json };
}

function enc(id: string) {
  return id.startsWith('/') || id.includes('//') ? encodeURIComponent(encodeURIComponent(id)) : encodeURIComponent(id);
}

type Instance = { uuid: string; start: string; id: string; topic: string };

/** Every past meeting instance in the window: previous meetings by id, then each id's past instances (covers the personal room). */
async function pastInstances(token: string): Promise<Instance[]> {
  const ids = new Map<string, string>();
  let page = '';
  for (let i = 0; i < 5; i += 1) {
    const q = new URLSearchParams({ type: 'previous_meetings', page_size: '300' });
    if (page) q.set('next_page_token', page);
    const r = await zget<{ meetings?: Array<{ id?: number | string; topic?: string }>; next_page_token?: string }>(token, `/users/me/meetings?${q}`);
    for (const m of r.json?.meetings || []) if (m.id) ids.set(String(m.id), String(m.topic || ''));
    page = r.json?.next_page_token || '';
    if (!page) break;
  }
  const me = await zget<{ pmi?: number | string }>(token, '/users/me');
  if (me.json?.pmi) ids.set(String(me.json.pmi), ids.get(String(me.json.pmi)) || 'Personal Meeting Room');
  const since = Date.now() - DAYS_BACK * 86400000;
  const out = new Map<string, Instance>();
  for (const [id, topic] of ids) {
    const r = await zget<{ meetings?: Array<{ uuid?: string; start_time?: string }> }>(token, `/past_meetings/${encodeURIComponent(id)}/instances`);
    for (const m of r.json?.meetings || []) {
      if (!m.uuid || !m.start_time || Date.parse(m.start_time) < since) continue;
      out.set(m.uuid, { uuid: m.uuid, start: m.start_time, id, topic });
    }
  }
  return [...out.values()].sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

/** Speaker turns from whatever shape Zoom returns: segments with speaker and text, or "Name: text" lines. */
function turnsFrom(content: Record<string, unknown>): Turn[] {
  const turns: Turn[] = [];
  const push = (who: string, text: string) => {
    const t = String(text || '').trim();
    if (!t) return;
    const last = turns[turns.length - 1];
    if (last && last.who === who) last.text = `${last.text} ${t}`;
    else turns.push({ who, text: t });
  };
  const tr = (content.transcript || {}) as Record<string, unknown>;
  const speakers = new Map<string, string>();
  for (const s of (tr.speakers || tr.speaker_list || []) as Array<Record<string, unknown>>) {
    const key = String(s.id ?? s.speaker_id ?? '');
    const name = String(s.name ?? s.display_name ?? '');
    if (key) speakers.set(key, name);
  }
  const items = (tr.segments || tr.transcript_items || tr.items || []) as Array<Record<string, unknown>>;
  for (const it of items) {
    const raw = String(it.text ?? it.content ?? '');
    const hit = raw.match(/^([^:]{1,60}):\s*(.+)$/);
    const named = String(it.speaker_name ?? it.speaker ?? it.display_name ?? speakers.get(String(it.speaker_id ?? '')) ?? '');
    if (named && !hit) push(named, raw);
    else if (hit) push(hit[1].trim(), hit[2]);
    else push(named, raw);
  }
  return turns;
}

type Brief = { title: string; recap: string; next: string[]; decided: string[] };

/** One short pass over the transcript for a title in the house style, a recap, decisions and next steps. */
async function brief(transcript: string, attendees: string[], fallback: string): Promise<Brief> {
  const empty = { title: fallback, recap: '', next: [], decided: [] };
  const key = env('ANTHROPIC_API_KEY');
  if (!key || !transcript) return empty;
  const res = await outbound('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: env('CEO_MODEL') || 'claude-sonnet-4-5',
      max_tokens: 900,
      system:
        'You write meeting notes for Chad Johnston, founder of 4orm Finance. Reply with JSON only: {"title":"<who - topic, under 70 chars, like \'Dean McCall - sales and fundraising coaching\'; add (solo) if only Chad spoke>","recap":"<3-5 plain sentences>","decided":["..."],"next":["<owner: action>"]}. Plain words, no emoji.',
      messages: [{ role: 'user', content: `Attendees: ${attendees.join(', ') || 'unknown'}\n\nTranscript:\n${transcript.slice(0, 60000)}` }],
    }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => null);
  if (!res?.ok) return empty;
  const body = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }> } | null;
  const text = (body?.content || []).map((b) => b.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return empty;
  try {
    const j = JSON.parse(m[0]) as Partial<Brief>;
    return {
      title: String(j.title || fallback).slice(0, 180),
      recap: String(j.recap || '').slice(0, 2000),
      next: (Array.isArray(j.next) ? j.next : []).map(String).slice(0, 12),
      decided: (Array.isArray(j.decided) ? j.decided : []).map(String).slice(0, 12),
    };
  } catch {
    return empty;
  }
}

const SELF = new Set(['chad johnston', 'chad']);

export type NotesSyncResult = { connected: boolean; meetings: number; added: number; reason: string };

/** Pull My Notes for past meetings not yet on the desk. known = note ids already holding content. */
export async function syncMyNotes(sql: Sql, ownerId: string, known: Set<string>, limit = PER_SYNC): Promise<NotesSyncResult> {
  const result: NotesSyncResult = { connected: false, meetings: 0, added: 0, reason: '' };
  if (!zoomNotesConfigured()) return { ...result, reason: 'ZOOM_OAUTH_CLIENT_ID / ZOOM_OAUTH_CLIENT_SECRET missing' };
  const token = await accessToken(sql, ownerId);
  if (!token) return { ...result, reason: notesError };
  result.connected = true;
  const instances = await pastInstances(token);
  result.meetings = instances.length;
  /* Meetings with no My Notes are skipped quickly; the cap counts notes landed, and the run stops at 40 s. */
  const todo = instances.filter((m) => !known.has(m.uuid));
  const started = Date.now();
  for (const m of todo) {
    if (result.added >= limit || Date.now() - started > 40_000) break;
    try {
      const list = await zget<{ notes?: Array<{ note_id?: string; note_name?: string; note_link?: string }> }>(
        token,
        `/my_notes/notes?meeting_id=${enc(m.uuid)}`,
      );
      if (!list.ok) {
        result.reason = `my_notes list ${list.status}`;
        continue;
      }
      const note = (list.json?.notes || [])[0];
      if (!note?.note_id) continue;
      const got = await zget<Record<string, unknown>>(token, `/my_notes/notes/${encodeURIComponent(note.note_id)}/content?include=transcript`);
      if (!got.ok || !got.json) {
        result.reason = `my_notes content ${got.status}`;
        continue;
      }
      const turns = turnsFrom(got.json);
      const generated = String(got.json.generated_note_content || '');
      const manual = String(got.json.manual_note_content || '');
      const transcript = turns.map((t) => `${t.who}: ${t.text}`).join('\n');
      if (!transcript && !generated && !manual) continue;
      const speakers = [...new Set(turns.map((t) => t.who).filter((w) => w && !/^iphone$/i.test(w)))];
      const solo = !!turns.length && speakers.every((w) => SELF.has(w.toLowerCase()) || SELF.has(w.toLowerCase().split(/\s+/)[0]));
      const b = await brief(transcript || generated || manual, speakers, String(note.note_name || m.topic || 'Zoom meeting'));
      const intel: { label: string; value: string }[] = [];
      if (b.recap) intel.push({ label: 'Recap', value: b.recap });
      if (generated) intel.push({ label: 'Zoom summary', value: generated.slice(0, 1500) });
      if (b.decided.length) intel.push({ label: 'Decided', value: b.decided.join(' | ').slice(0, 1500) });
      if (b.next.length) intel.push({ label: 'Next steps', value: b.next.join(' | ').slice(0, 1500) });
      if (manual) intel.push({ label: 'My notes', value: manual.slice(0, 1500) });
      const others = othersFrom(turns, SELF);
      const date = new Date(m.start).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
      const link = String(got.json.note_url || note.note_link || '');
      const rows = await sql`
        INSERT INTO zoom_notes (owner_id, note_id, note_date, title, attendees, solo, others, intel, improve, sources)
        VALUES (${ownerId}, ${m.uuid}, ${date}::date, ${b.title}, ${JSON.stringify(speakers.slice(0, 20))}::jsonb, ${solo},
                ${JSON.stringify(others)}::jsonb, ${JSON.stringify(intel)}::jsonb, '[]'::jsonb,
                ${JSON.stringify([{ name: 'Zoom My Notes', url: link || null }])}::jsonb)
        ON CONFLICT (owner_id, note_id) DO UPDATE SET
          title = EXCLUDED.title, attendees = EXCLUDED.attendees, solo = EXCLUDED.solo,
          others = EXCLUDED.others, intel = EXCLUDED.intel, sources = EXCLUDED.sources
        WHERE zoom_notes.others = '[]'::jsonb AND zoom_notes.intel = '[]'::jsonb
        RETURNING id
      `;
      if (!rows.length) continue;
      try {
        await sql`
          UPDATE zoom_notes SET
            transcript = ${transcript.slice(0, 400000)},
            ai_summary = ${b.recap || generated.slice(0, 1500) || null},
            decided = ${JSON.stringify(b.decided)}::jsonb,
            origin = 'Zoom My Notes',
            recording_url = ${link || null},
            duration_min = NULL,
            raw_notes = ${others.join('\n')}
          WHERE id = ${rows[0].id} AND owner_id = ${ownerId}
        `;
      } catch (err) {
        fail('zoom_notes_extra', err);
      }
      result.added += 1;
    } catch (err) {
      fail('zoom_my_notes', err);
    }
  }
  return result;
}
