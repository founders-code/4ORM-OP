import type { NeonQueryFunction } from '@neondatabase/serverless';
import seed from '../zoom_notes_seed.json';

type Sql = NeonQueryFunction<false, false>;

type ZoomSeed = {
  noteId: string;
  date: string;
  title: string;
  attendees: string[];
  summary: string[];
  stats: { label: string; value: string }[];
  sources: { name: string; url: string | null }[];
};

export const ZOOM_SEED = seed as ZoomSeed[];

export function shapeZoom(row: Record<string, unknown>) {
  const date = row.note_date ? String(row.note_date).slice(0, 10) : '';
  return {
    id: String(row.id),
    noteId: String(row.note_id || ''),
    date,
    title: String(row.title || ''),
    attendees: Array.isArray(row.attendees) ? row.attendees.map((name) => String(name)) : [],
    summary: Array.isArray(row.summary) ? row.summary.map((line) => String(line)) : [],
    stats: Array.isArray(row.stats) ? row.stats : [],
    sources: Array.isArray(row.sources) ? row.sources : [],
  };
}

/** Insert the transcript library once. A single existing row blocks another seed. */
export async function seedZoomNotes(sql: Sql, ownerId: string) {
  const payload = JSON.stringify(ZOOM_SEED);
  await sql`
    INSERT INTO zoom_notes (owner_id, note_id, note_date, title, attendees, summary, stats, sources)
    SELECT ${ownerId}, x."noteId", x.date::date, x.title, x.attendees, x.summary, x.stats, x.sources
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      "noteId" text,
      date text,
      title text,
      attendees jsonb,
      summary jsonb,
      stats jsonb,
      sources jsonb
    )
    WHERE NOT EXISTS (SELECT 1 FROM zoom_notes WHERE owner_id = ${ownerId})
    ON CONFLICT (owner_id, note_id) DO NOTHING
  `;
}

export async function listZoomNotes(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT id, note_id, note_date::text AS note_date, title, attendees, summary, stats, sources
    FROM zoom_notes
    WHERE owner_id = ${ownerId}
    ORDER BY note_date DESC, title ASC
    LIMIT 200
  `;
  return rows.map((row) => shapeZoom(row as Record<string, unknown>));
}
