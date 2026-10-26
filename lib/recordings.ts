import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { fail } from './log';
import { ensureMeetingActions } from './meeting-actions';
import { listZoomNotes } from './zoom-notes';

type Sql = NeonQueryFunction<false, false>;

const TYPES = ['zoom', 'person', 'call', 'voice'] as const;
export type RecType = (typeof TYPES)[number];

export async function ensureRecordings(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS recordings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      type text NOT NULL DEFAULT 'person',
      title text NOT NULL DEFAULT '',
      summary text NOT NULL DEFAULT '',
      people jsonb NOT NULL DEFAULT '[]'::jsonb,
      duration_s int NOT NULL DEFAULT 0,
      started_at timestamptz,
      audio_ref text NOT NULL DEFAULT '',
      audio_b64 text NOT NULL DEFAULT '',
      transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'ready',
      step text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )`;
    await sql`CREATE TABLE IF NOT EXISTS recording_chunks (
      owner_id text NOT NULL,
      rec_id uuid NOT NULL,
      n int NOT NULL,
      payload text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, rec_id, n)
    )`;
  } catch (err) {
    fail('recordings_table', err);
  }
}

function peopleOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 40);
  if (typeof value === 'string') {
    try { return peopleOf(JSON.parse(value)); } catch { return value.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 40); }
  }
  return [];
}

function transcriptOf(value: unknown): Array<{ t: string; who: string; text: string }> {
  if (typeof value === 'string') {
    try { return transcriptOf(JSON.parse(value)); } catch {
      return value ? [{ t: '00:00', who: '', text: value.slice(0, 8000) }] : [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (typeof row === 'string') return { t: '00:00', who: '', text: row.slice(0, 800) };
    const r = row as Record<string, unknown>;
    return { t: String(r.t || r.time || '00:00').slice(0, 12), who: String(r.who || r.speaker || '').slice(0, 80), text: String(r.text || '').slice(0, 800) };
  }).filter((row) => row.text);
}

export function shapeRecording(row: Record<string, unknown>, extra?: { hasAudio?: boolean }) {
  return {
    id: String(row.id),
    type: TYPES.includes(String(row.type) as RecType) ? String(row.type) : 'person',
    title: String(row.title || ''),
    summary: String(row.summary || ''),
    people: peopleOf(row.people),
    duration_s: Number(row.duration_s) || 0,
    started_at: row.started_at ? new Date(String(row.started_at)).toISOString() : '',
    audio_ref: String(row.audio_ref || ''),
    hasAudio: extra?.hasAudio ?? !!(row.has_audio || row.audio_b64),
    transcript: transcriptOf(row.transcript),
    status: String(row.status || 'ready'),
    step: String(row.step || ''),
    fromZoom: false,
  };
}

export async function listRecordings(sql: Sql, ownerId: string) {
  await ensureRecordings(sql);
  try {
    const rows = await sql`
      SELECT id, type, title, summary, people, duration_s, started_at, audio_ref,
             transcript, status, step, created_at,
             (audio_b64 IS NOT NULL AND audio_b64 <> '') AS has_audio
      FROM recordings
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY COALESCE(started_at, created_at) DESC
      LIMIT 200
    `;
    const recs = (rows as Record<string, unknown>[]).map((row) => shapeRecording(row));
    let zoom: ReturnType<typeof shapeRecording>[] = [];
    try {
      const notes = await listZoomNotes(sql, ownerId);
      zoom = notes.slice(0, 80).map((n) => {
        const id = String(n.id || n.noteId || '');
        const others = Array.isArray(n.others) ? n.others.map(String) : [];
        return {
          id: 'zn-' + id,
          type: 'zoom',
          title: String(n.title || ''),
          summary: others.slice(0, 3).join(' ') || String(n.title || ''),
          people: Array.isArray(n.attendees) ? n.attendees.map(String) : [],
          duration_s: 0,
          started_at: String(n.date || ''),
          audio_ref: '',
          hasAudio: false,
          transcript: [],
          status: 'ready',
          step: '',
          fromZoom: true,
        };
      });
    } catch (err) {
      fail('recordings_zoom_list', err);
    }
    const recZoomTitles = new Set(recs.filter((r) => r.type === 'zoom').map((r) => r.title.toLowerCase()));
    const extraZoom = zoom.filter((z) => !recZoomTitles.has(z.title.toLowerCase()));
    return recs.concat(extraZoom);
  } catch (err) {
    fail('recordings_list', err);
    return [];
  }
}

export async function getRecording(sql: Sql, ownerId: string, id: string) {
  await ensureRecordings(sql);
  const rows = await sql`
    SELECT id, type, title, summary, people, duration_s, started_at, audio_ref, audio_b64,
           transcript, status, step, created_at
    FROM recordings
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? shapeRecording(row, { hasAudio: !!(row.audio_b64) }) : null;
}

export async function getRecordingAudio(sql: Sql, ownerId: string, id: string) {
  await ensureRecordings(sql);
  const rows = await sql`SELECT audio_b64 FROM recordings WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL LIMIT 1`;
  return String((rows[0] as { audio_b64?: string } | undefined)?.audio_b64 || '');
}

export async function createRecording(sql: Sql, ownerId: string, input: { type?: string; people?: unknown; duration_s?: number; started_at?: string }) {
  await ensureRecordings(sql);
  const type = TYPES.includes(String(input.type) as RecType) ? String(input.type) : 'person';
  const people = JSON.stringify(peopleOf(input.people));
  const dur = Math.max(0, Math.min(8 * 3600, Number(input.duration_s) || 0));
  const started = input.started_at ? new Date(input.started_at).toISOString() : new Date().toISOString();
  const rows = await sql`
    INSERT INTO recordings (owner_id, type, people, duration_s, started_at, status, step, title)
    VALUES (${ownerId}, ${type}, ${people}::jsonb, ${dur}, ${started}::timestamptz, 'transcribing', 'Transcribing', '')
    RETURNING id, type, title, summary, people, duration_s, started_at, audio_ref, transcript, status, step, created_at
  `;
  return shapeRecording(rows[0] as Record<string, unknown>);
}

export async function saveChunk(sql: Sql, ownerId: string, recId: string, n: number, payload: string) {
  await ensureRecordings(sql);
  const idx = Math.max(0, Math.min(400, Math.floor(n)));
  const body = String(payload || '').slice(0, 1_200_000);
  if (!body) return;
  await sql`
    INSERT INTO recording_chunks (owner_id, rec_id, n, payload)
    VALUES (${ownerId}, ${recId}::uuid, ${idx}, ${body})
    ON CONFLICT (owner_id, rec_id, n) DO UPDATE SET payload = EXCLUDED.payload
  `;
}

export async function assembleChunks(sql: Sql, ownerId: string, recId: string) {
  const rows = await sql`
    SELECT n, payload FROM recording_chunks
    WHERE owner_id = ${ownerId} AND rec_id = ${recId}::uuid
    ORDER BY n
  `;
  const parts = (rows as Array<{ payload?: string }>).map((r) => String(r.payload || ''));
  if (!parts.length) return '';
  const joined = parts.join('');
  await sql`UPDATE recordings SET audio_b64 = ${joined}, updated_at = now() WHERE id = ${recId}::uuid AND owner_id = ${ownerId}`;
  await sql`DELETE FROM recording_chunks WHERE owner_id = ${ownerId} AND rec_id = ${recId}::uuid`;
  return joined;
}

export async function saveAudio(sql: Sql, ownerId: string, recId: string, b64: string) {
  await ensureRecordings(sql);
  const body = String(b64 || '').slice(0, 12_000_000);
  await sql`UPDATE recordings SET audio_b64 = ${body}, updated_at = now() WHERE id = ${recId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
}

export async function patchRecording(sql: Sql, ownerId: string, id: string, input: Record<string, unknown>) {
  await ensureRecordings(sql);
  const title = input.title != null ? String(input.title).slice(0, 240) : null;
  const type = input.type != null && TYPES.includes(String(input.type) as RecType) ? String(input.type) : null;
  const people = input.people != null ? JSON.stringify(peopleOf(input.people)) : null;
  const status = input.status != null ? String(input.status).slice(0, 40) : null;
  const rows = await sql`
    UPDATE recordings SET
      title = CASE WHEN ${title}::text IS NULL THEN title ELSE ${title} END,
      type = CASE WHEN ${type}::text IS NULL THEN type ELSE ${type} END,
      people = CASE WHEN ${people}::text IS NULL THEN people ELSE ${people}::jsonb END,
      status = CASE WHEN ${status}::text IS NULL THEN status ELSE ${status} END,
      updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
    RETURNING id, type, title, summary, people, duration_s, started_at, audio_ref, transcript, status, step, created_at
  `;
  return rows[0] ? shapeRecording(rows[0] as Record<string, unknown>) : null;
}

export async function softDeleteRecording(sql: Sql, ownerId: string, id: string) {
  await ensureRecordings(sql);
  await sql`UPDATE recordings SET deleted_at = now(), updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
}

async function transcribeB64(b64: string) {
  const key = env('OPENAI_API_KEY');
  if (!key || !b64) return '';
  const bytes = Buffer.from(b64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/webm' }), 'recording.webm');
  form.append('model', 'gpt-4o-transcribe');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90000),
  });
  const json = await res.json().catch(() => null) as { text?: string } | null;
  return String(json?.text || '');
}

async function summarizeTranscript(transcript: string, people: string[]) {
  const key = env('OPENAI_API_KEY');
  if (!key || !transcript.trim()) {
    return { title: '', summary: '', people, action_items: [] as Array<{ text: string; due: string }> };
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return JSON {title, summary, people, action_items}. summary is 2-3 sentences. action_items is [{text, due}]. due is a short label like today, Wed, or empty. people is names mentioned. title is a short meeting title.' },
        { role: 'user', content: `People present: ${people.join(', ') || 'unknown'}\n\nTranscript:\n${transcript.slice(0, 12000)}` },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  const json = await res.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(String(json?.choices?.[0]?.message?.content || '{}')); } catch { parsed = {}; }
  const items = Array.isArray(parsed.action_items) ? parsed.action_items : [];
  return {
    title: String(parsed.title || '').slice(0, 180),
    summary: String(parsed.summary || '').slice(0, 1200),
    people: peopleOf(parsed.people).length ? peopleOf(parsed.people) : people,
    action_items: items.map((row) => {
      const r = row as Record<string, unknown>;
      return { text: String(r.text || '').slice(0, 240), due: String(r.due || '').slice(0, 40) };
    }).filter((row) => row.text),
  };
}

export async function processRecording(sql: Sql, ownerId: string, id: string) {
  await ensureRecordings(sql);
  await ensureMeetingActions(sql);
  const rows = await sql`SELECT audio_b64, people, title FROM recordings WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL LIMIT 1`;
  const row = rows[0] as { audio_b64?: string; people?: unknown; title?: string } | undefined;
  if (!row) return null;
  await sql`UPDATE recordings SET status = 'transcribing', step = 'Transcribing', updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  const text = await transcribeB64(String(row.audio_b64 || ''));
  await sql`UPDATE recordings SET status = 'summarizing', step = 'Writing the title and summary', transcript = ${JSON.stringify([{ t: '00:00', who: '', text }])}::jsonb, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  const meta = await summarizeTranscript(text, peopleOf(row.people));
  await sql`UPDATE recordings SET step = 'Finding action items', updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  const title = meta.title || String(row.title || '').trim() || (text.split(/[.!?]/)[0] || 'Recording').slice(0, 80);
  await sql`
    UPDATE recordings SET
      title = ${title},
      summary = ${meta.summary},
      people = ${JSON.stringify(meta.people)}::jsonb,
      status = 'ready',
      step = '',
      updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId}
  `;
  const date = new Date().toISOString().slice(0, 10);
  for (const item of meta.action_items.slice(0, 20)) {
    try {
      await sql`
        INSERT INTO meeting_actions (owner_id, source, meeting_id, meeting_title, meeting_date, text, kind)
        VALUES (${ownerId}, 'recording', ${id}, ${title}, ${date}, ${item.text}, 'you_said')
        ON CONFLICT (owner_id, meeting_id, text) DO NOTHING
      `;
    } catch (err) {
      fail('recording_action', err);
    }
  }
  return getRecording(sql, ownerId, id);
}
