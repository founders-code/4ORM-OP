import type { NeonQueryFunction } from '@neondatabase/serverless';
import { ensureZoomExtra } from './zoom-notes';

type Sql = NeonQueryFunction<false, false>;

/** sync_state row for a keyed integration (granola / riverside / perplexity). Status words match lib/sync.ts. */
export async function markSource(sql: Sql, ownerId: string, source: string, status: string, detail: string) {
  try {
    await sql`
      INSERT INTO sync_state (owner_id, source, status, detail, synced_at)
      VALUES (${ownerId}, ${source}, ${status}, ${detail.slice(0, 200)}, now())
      ON CONFLICT (owner_id, source)
      DO UPDATE SET status = EXCLUDED.status, detail = EXCLUDED.detail, synced_at = now()
    `;
  } catch {
    /* status is best effort */
  }
}

export async function lastSourceSync(sql: Sql, ownerId: string, source: string) {
  try {
    const rows = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = ${source} LIMIT 1`;
    const at = rows[0]?.synced_at ? Date.parse(String(rows[0].synced_at)) : NaN;
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

export type RecordNote = {
  noteId: string;
  origin: 'granola' | 'riverside';
  date: string;
  title: string;
  attendees: string[];
  summary: string;
  rawNotes: string;
  transcript: string;
  recordingUrl: string;
  durationMin: number | null;
  sources: Array<{ name: string; url: string | null }>;
};

/**
 * One meeting from Granola or Riverside into zoom_notes (the Record section). Additive: a new row is inserted;
 * an existing row only has EMPTY fields filled, so edits made in 4orm are never overwritten.
 * Returns 'added' | 'filled' | 'same'.
 */
export async function saveRecordNote(sql: Sql, ownerId: string, n: RecordNote) {
  await ensureZoomExtra(sql);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(n.date) ? n.date : new Date().toISOString().slice(0, 10);
  const title = (n.title || (n.origin === 'granola' ? 'Granola note' : 'Riverside recording')).slice(0, 300);
  const others = n.summary ? n.summary.split(/\n+/).map((l) => l.replace(/^[-*#\s]+/, '').trim()).filter(Boolean).slice(0, 40) : [];
  const existing = await sql`SELECT id FROM zoom_notes WHERE owner_id = ${ownerId} AND note_id = ${n.noteId} LIMIT 1`;
  if (!existing.length) {
    await sql`
      INSERT INTO zoom_notes (owner_id, note_id, note_date, title, attendees, solo, others, intel, improve, sources,
        ai_summary, origin, transcript, recording_url, duration_min, raw_notes)
      VALUES (${ownerId}, ${n.noteId}, ${date}::date, ${title}, ${JSON.stringify(n.attendees.slice(0, 30))}::jsonb,
        ${n.attendees.length === 0}, ${JSON.stringify(others)}::jsonb, '[]'::jsonb, '[]'::jsonb, ${JSON.stringify(n.sources)}::jsonb,
        ${n.summary.slice(0, 8000)}, ${n.origin}, ${n.transcript.slice(0, 200000)}, ${n.recordingUrl.slice(0, 1000)},
        ${n.durationMin}, ${n.rawNotes.slice(0, 20000)})
      ON CONFLICT (owner_id, note_id) DO NOTHING
    `;
    return 'added' as const;
  }
  const rows = await sql`
    UPDATE zoom_notes SET
      ai_summary = COALESCE(NULLIF(ai_summary, ''), ${n.summary.slice(0, 8000) || null}),
      transcript = COALESCE(NULLIF(transcript, ''), ${n.transcript.slice(0, 200000) || null}),
      recording_url = COALESCE(NULLIF(recording_url, ''), ${n.recordingUrl.slice(0, 1000) || null}),
      raw_notes = COALESCE(NULLIF(raw_notes, ''), ${n.rawNotes.slice(0, 20000) || null}),
      duration_min = COALESCE(duration_min, ${n.durationMin}),
      origin = COALESCE(NULLIF(origin, ''), ${n.origin})
    WHERE owner_id = ${ownerId} AND note_id = ${n.noteId}
      AND ((COALESCE(ai_summary, '') = '' AND ${n.summary} <> '')
        OR (COALESCE(transcript, '') = '' AND ${n.transcript} <> '')
        OR (COALESCE(recording_url, '') = '' AND ${n.recordingUrl} <> ''))
    RETURNING id
  `;
  return rows.length ? ('filled' as const) : ('same' as const);
}

/** Vancouver calendar day for an ISO time. */
export function vanDay(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}
