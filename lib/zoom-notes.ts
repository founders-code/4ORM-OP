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

function originOf(row: Record<string, unknown>) {
  const stored = String(row.origin || '').toLowerCase();
  if (stored === 'granola' || stored === 'zoom' || stored === 'riverside') return stored;
  const blob = asArray(row.sources).map((item) => String((item as { name?: string })?.name || '')).join(' ').toLowerCase();
  if (/granola/.test(blob)) return 'granola';
  return 'zoom';
}

export function shapeZoom(row: Record<string, unknown>) {
  const date = row.note_date ? String(row.note_date).slice(0, 10) : '';
  const others = asArray(row.others).map((line) => String(line));
  const intel = asArray(row.intel).map((item) => {
    const rowItem = item as { label?: string; value?: string };
    return { label: String(rowItem?.label || ''), value: String(rowItem?.value || '') };
  });
  const quotes = asArray(row.quotes).map((item) => {
    if (Array.isArray(item)) return [String(item[0] || ''), String(item[1] || '')];
    const rowItem = item as { who?: string; text?: string };
    return [String(rowItem?.who || ''), String(rowItem?.text || item || '')];
  }).filter((pair) => pair[1]);
  return {
    id: String(row.id),
    noteId: String(row.note_id || ''),
    date,
    title: String(row.title || ''),
    attendees: asArray(row.attendees).map((name) => String(name)),
    solo: row.solo === true || row.solo === 'true',
    others,
    intel,
    improve: asArray(row.improve).map((line) => String(line)),
    sources: asArray(row.sources).map((item) => {
      const rowItem = item as { name?: string; url?: string | null };
      return { name: String(rowItem?.name || ''), url: rowItem?.url ? String(rowItem.url) : null };
    }),
    aiSummary: String(row.ai_summary || ''),
    quotes,
    decided: asArray(row.decided).map((line) => String(line)),
    origin: originOf(row),
    transcript: String(row.transcript || ''),
    recordingUrl: String(row.recording_url || ''),
    durationMin: row.duration_min == null ? null : Number(row.duration_min),
    rawNotes: String(row.raw_notes || others.join('\n')),
  };
}

/** Additive columns for the slide-in reader. Existing rows and values are never dropped. */
export async function ensureZoomExtra(sql: Sql) {
  const stmts = [
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS ai_summary text`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS quotes jsonb NOT NULL DEFAULT '[]'::jsonb`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS decided jsonb NOT NULL DEFAULT '[]'::jsonb`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS origin text`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS transcript text`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS recording_url text`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS duration_min integer`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS raw_notes text`,
    sql`ALTER TABLE zoom_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`,
  ];
  for (const stmt of stmts) {
    try { await stmt; } catch { /* column already there */ }
  }
}

/** Additive only. Existing Zoom notes are never deleted. */
export async function seedZoomNotes(sql: Sql, ownerId: string) {
  const version = await sql`
    SELECT zoom_seed_version FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1
  `;
  if (String(version[0]?.zoom_seed_version || '') === ZOOM_SEED_VERSION) return;
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
    ON CONFLICT (owner_id, note_id) DO NOTHING
  `;
  await sql`
    INSERT INTO owner_settings (owner_id, zoom_seed_version)
    VALUES (${ownerId}, ${ZOOM_SEED_VERSION})
    ON CONFLICT (owner_id) DO UPDATE SET zoom_seed_version = EXCLUDED.zoom_seed_version
  `;
}

function fallbackSummary(note: ReturnType<typeof shapeZoom>) {
  if (note.aiSummary) return note.aiSummary;
  const said = note.others.join(' ');
  if (said) return said.slice(0, 420);
  const intel = note.intel.map((row) => row.value || row.label).filter(Boolean).join(' ');
  return intel.slice(0, 420);
}

async function writeMissingIntel(sql: Sql, ownerId: string, note: ReturnType<typeof shapeZoom>) {
  if (note.aiSummary) return;
  const summary = fallbackSummary(note);
  if (!summary) return;
  try {
    await sql`
      UPDATE zoom_notes
      SET ai_summary = COALESCE(NULLIF(ai_summary, ''), ${summary}),
          raw_notes = COALESCE(NULLIF(raw_notes, ''), ${note.others.join('\n')}),
          origin = COALESCE(NULLIF(origin, ''), ${note.origin})
      WHERE id = ${note.id} AND owner_id = ${ownerId}
    `;
    note.aiSummary = summary;
  } catch {
    /* fail soft - reader still shows raw notes */
  }
}

export async function listZoomNotes(sql: Sql, ownerId: string) {
  await ensureZoomExtra(sql);
  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = await sql`
      SELECT id, note_id, note_date::text AS note_date, title, attendees, solo, others, intel, improve, sources,
             ai_summary, quotes, decided, origin, transcript, recording_url, duration_min, raw_notes
      FROM zoom_notes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY note_date DESC, title ASC
      LIMIT 200
    ` as Array<Record<string, unknown>>;
  } catch {
    rows = await sql`
      SELECT id, note_id, note_date::text AS note_date, title, attendees, solo, others, intel, improve, sources
      FROM zoom_notes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY note_date DESC, title ASC
      LIMIT 200
    ` as Array<Record<string, unknown>>;
  }
  const notes = rows.map((row) => shapeZoom(row));
  for (const note of notes) {
    if (!note.aiSummary) await writeMissingIntel(sql, ownerId, note);
  }
  return notes;
}
