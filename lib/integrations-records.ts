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

/** Vancouver calendar day for an ISO time. */
export function vanDay(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}
