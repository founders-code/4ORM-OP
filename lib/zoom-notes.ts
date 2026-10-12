import type { NeonQueryFunction } from '@neondatabase/serverless';
import seed from '../zoom_notes_seed.json';

type Sql = NeonQueryFunction<false, false>;

type ZoomSeed = {
  noteId: string;
  date: string;
  title: string;
  attendees: string[];
  solo: boolean;
  others: string[];
  intel: { label: string; value: string }[];
  improve: string[];
  sources: { name: string; url: string | null }[];
};

/**
 * Meeting summaries capture what the OTHER participants said: their intel,
 * advice, questions, objections, and the numbers they brought. Never Chad's
 * own pitch or stats. Every note also carries a "Where I can improve" list.
 * Future note ingestion must populate others, intel, and improve this way.
 */
export const ZOOM_SEED_VERSION = 'v2-others-intel';
export const ZOOM_SEED = seed as ZoomSeed[];

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function shapeZoom(row: Record<string, unknown>) {
  const date = row.note_date ? String(row.note_date).slice(0, 10) : '';
  return {
    id: String(row.id),
    noteId: String(row.note_id || ''),
    date,
    title: String(row.title || ''),
    attendees: asArray(row.attendees).map((name) => String(name)),
    solo: row.solo === true || row.solo === 'true',
    others: asArray(row.others).map((line) => String(line)),
    intel: asArray(row.intel).map((item) => {
      const rowItem = item as { label?: string; value?: string };
      return { label: String(rowItem?.label || ''), value: String(rowItem?.value || '') };
    }),
    improve: asArray(row.improve).map((line) => String(line)),
    sources: asArray(row.sources).map((item) => {
      const rowItem = item as { name?: string; url?: string | null };
      return { name: String(rowItem?.name || ''), url: rowItem?.url ? String(rowItem.url) : null };
    }),
  };
}

/** Wipe and reload only when the stored seed version is not the others/intel cut. */
export async function seedZoomNotes(sql: Sql, ownerId: string) {
  const version = await sql`
    SELECT zoom_seed_version FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1
  `;
  if (String(version[0]?.zoom_seed_version || '') === ZOOM_SEED_VERSION) return;
  await sql`DELETE FROM zoom_notes WHERE owner_id = ${ownerId}`;
  const payload = JSON.stringify(ZOOM_SEED);
  await sql`
    INSERT INTO zoom_notes (owner_id, note_id, note_date, title, attendees, solo, others, intel, improve, sources)
    SELECT ${ownerId}, x."noteId", x.date::date, x.title, x.attendees, COALESCE(x.solo, false),
           COALESCE(x.others, '[]'::jsonb), COALESCE(x.intel, '[]'::jsonb),
           COALESCE(x.improve, '[]'::jsonb), COALESCE(x.sources, '[]'::jsonb)
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      "noteId" text,
      date text,
      title text,
      attendees jsonb,
      solo boolean,
      others jsonb,
      intel jsonb,
      improve jsonb,
      sources jsonb
    )
    ON CONFLICT (owner_id, note_id) DO UPDATE SET
      note_date = EXCLUDED.note_date,
      title = EXCLUDED.title,
      attendees = EXCLUDED.attendees,
      solo = EXCLUDED.solo,
      others = EXCLUDED.others,
      intel = EXCLUDED.intel,
      improve = EXCLUDED.improve,
      sources = EXCLUDED.sources
  `;
  await sql`
    INSERT INTO owner_settings (owner_id, zoom_seed_version)
    VALUES (${ownerId}, ${ZOOM_SEED_VERSION})
    ON CONFLICT (owner_id) DO UPDATE SET zoom_seed_version = EXCLUDED.zoom_seed_version
  `;
}

export async function listZoomNotes(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT id, note_id, note_date::text AS note_date, title, attendees, solo, others, intel, improve, sources
    FROM zoom_notes
    WHERE owner_id = ${ownerId}
    ORDER BY note_date DESC, title ASC
    LIMIT 200
  `;
  return rows.map((row) => shapeZoom(row as Record<string, unknown>));
}
