import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

export type DupeRow = { id: string; label: string; created_at: string | null };
export type DupeGroup = { key: string; keep: DupeRow; remove: DupeRow[] };

/** Item statuses that are on the board. done and dropped are history and are never swept or kept. */
export const LIVE_ITEM_STATUSES = ['new', 'doing', 'waiting', 'open'] as const;

type SweptTable = 'items' | 'notes' | 'links' | 'contacts' | 'spaces' | 'documents' | 'meeting_actions' | 'email_boxes';

function asRow(row: Record<string, unknown>): DupeRow {
  return {
    id: String(row.id),
    label: String(row.label || row.title || row.name || row.url || row.email || row.text || row.key || ''),
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

/** Rows must arrive ordered best-keeper first within each key. */
function groupRows(rows: Record<string, unknown>[]): DupeGroup[] {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = String(row.k || '');
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  const out: DupeGroup[] = [];
  for (const [key, list] of map) {
    if (list.length < 2) continue;
    const shaped = list.map(asRow);
    out.push({ key, keep: shaped[0], remove: shaped.slice(1) });
  }
  return out.sort((a, b) => b.remove.length - a.remove.length || a.key.localeCompare(b.key));
}

async function ensureSchema(sql: Sql) {
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE meeting_actions ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE email_boxes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`
    CREATE TABLE IF NOT EXISTS dedupe_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      table_name text NOT NULL,
      kept_id text NOT NULL,
      removed_id text NOT NULL,
      dup_key text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export async function listDupeGroups(sql: Sql, ownerId: string) {
  await ensureSchema(sql);
  // Only live items are grouped, so the keeper is always a live row. Among live rows the keeper is
  // the one not snoozed, then the most recently touched. done/dropped rows are never changed.
  const items = await sql`
    SELECT id, title AS label, created_at, lower(trim(title)) AS k
    FROM items
    WHERE owner_id = ${ownerId}
      AND status IN ('new', 'doing', 'waiting', 'open')
      AND deleted_at IS NULL
      AND trim(title) <> ''
    ORDER BY (snooze_until IS NULL OR snooze_until <= now()) DESC, updated_at DESC, created_at ASC, id ASC
  `;
  const notes = await sql`
    SELECT id, title AS label, created_at, (lower(trim(title)) || '\n' || md5(coalesce(body, ''))) AS k
    FROM notes
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(title) <> ''
    ORDER BY created_at ASC, id ASC
  `;
  const links = await sql`
    SELECT id, title AS label, url, created_at, lower(trim(url)) AS k
    FROM links
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(url) <> ''
    ORDER BY created_at ASC, id ASC
  `;
  const contacts = await sql`
    SELECT id, name AS label, email, created_at, lower(trim(email)) AS k
    FROM contacts
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND coalesce(trim(email), '') <> ''
    ORDER BY created_at ASC, id ASC
  `;
  const spaces = await sql`
    SELECT id, name AS label, created_at, lower(trim(name)) AS k
    FROM packages
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(name) <> ''
    ORDER BY created_at ASC, id ASC
  `;
  const documents = await sql`
    SELECT id, name AS label, drive_file_id, created_at, drive_file_id AS k
    FROM documents
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND coalesce(drive_file_id, '') <> ''
    ORDER BY created_at ASC, id ASC
  `;
  let meeting: Record<string, unknown>[] = [];
  try {
    meeting = (await sql`
      SELECT id, text AS label, created_at, lower(trim(text)) AS k
      FROM meeting_actions
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND status = 'open' AND trim(text) <> ''
      ORDER BY created_at ASC, id ASC
    `) as Record<string, unknown>[];
  } catch {
    meeting = [];
  }
  const boxes = await sql`
    SELECT id, name AS label, key, created_at, lower(trim(name)) AS k
    FROM email_boxes
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(name) <> ''
    ORDER BY created_at ASC, id ASC
  `;
  const tables: Record<SweptTable, DupeGroup[]> = {
    items: groupRows(items as Record<string, unknown>[]),
    notes: groupRows(notes as Record<string, unknown>[]),
    links: groupRows(links as Record<string, unknown>[]),
    contacts: groupRows(contacts as Record<string, unknown>[]),
    spaces: groupRows(spaces as Record<string, unknown>[]),
    documents: groupRows(documents as Record<string, unknown>[]),
    meeting_actions: groupRows(meeting),
    email_boxes: groupRows(boxes as Record<string, unknown>[]),
  };
  const counts: Record<string, number> = {};
  Object.entries(tables).forEach(([name, groups]) => {
    counts[name] = groups.reduce((n, g) => n + g.remove.length, 0);
  });
  return { tables, counts };
}

/**
 * Soft-removes one duplicate and logs its full prior row (to_jsonb of the row before the update) in
 * the same statement, so a restore can put back status, due, snooze, column, etc. exactly.
 * Returns true when the row was removed (false when it was already gone).
 */
async function sweepRow(sql: Sql, ownerId: string, table: SweptTable, keptId: string, removedId: string, key: string) {
  let rows: Record<string, unknown>[] = [];
  switch (table) {
    case 'items':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM items t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE items SET status = 'dropped', updated_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND status <> 'dropped'
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'items', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'notes':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM notes t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE notes SET deleted_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'notes', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'links':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM links t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE links SET deleted_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'links', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'contacts':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM contacts t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE contacts SET deleted_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'contacts', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'spaces':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM packages t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE packages SET deleted_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'spaces', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'documents':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM documents t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE documents SET deleted_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'documents', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'meeting_actions':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM meeting_actions t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE meeting_actions SET deleted_at = now(), status = 'dismissed'
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'meeting_actions', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
    case 'email_boxes':
      rows = await sql`
        WITH prior AS (SELECT to_jsonb(t) AS row FROM email_boxes t WHERE t.id = ${removedId}::uuid AND t.owner_id = ${ownerId}),
        gone AS (
          UPDATE email_boxes SET deleted_at = now()
          WHERE id = ${removedId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
          RETURNING id
        )
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        SELECT ${ownerId}, 'email_boxes', ${keptId}, ${removedId}, ${key}, prior.row FROM prior, gone
        RETURNING id
      `;
      break;
  }
  return rows.length > 0;
}

export async function applyDedupe(sql: Sql, ownerId: string) {
  const listed = await listDupeGroups(sql, ownerId);
  const applied: Record<string, number> = {};
  for (const [table, groups] of Object.entries(listed.tables) as Array<[SweptTable, DupeGroup[]]>) {
    let removed = 0;
    for (const g of groups) {
      for (const row of g.remove) {
        if (await sweepRow(sql, ownerId, table, g.keep.id, row.id, g.key)) removed += 1;
      }
    }
    applied[table] = removed;
  }
  try {
    await ensureLiveUniqueIndexes(sql);
  } catch {
    /* unique indexes apply after the sweep; leftover exact dups would block */
  }
  return { before: listed.counts, applied };
}

/**
 * Unique indexes over LIVE rows only. items: done/dropped/deleted rows are excluded, so a new task may
 * reuse the title of a finished one. The old items_owner_title_live_uq also covered done rows and is
 * dropped by the db.ts migration (db_items_title_open_uq).
 */
export async function ensureLiveUniqueIndexes(sql: Sql) {
  await sql`DROP INDEX IF EXISTS items_owner_title_live_uq`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS items_owner_title_open_uq ON items (owner_id, lower(trim(title))) WHERE status IN ('new', 'doing', 'waiting', 'open') AND deleted_at IS NULL AND trim(title) <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS notes_owner_title_body_live_uq ON notes (owner_id, lower(trim(title)), md5(coalesce(body, ''))) WHERE deleted_at IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS links_owner_url_live_uq ON links (owner_id, lower(trim(url))) WHERE deleted_at IS NULL AND trim(url) <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_email_live_uq ON contacts (owner_id, lower(trim(email))) WHERE deleted_at IS NULL AND coalesce(trim(email), '') <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS packages_owner_name_live_uq ON packages (owner_id, lower(trim(name))) WHERE deleted_at IS NULL AND trim(name) <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS documents_owner_drive_live_uq ON documents (owner_id, drive_file_id) WHERE deleted_at IS NULL AND coalesce(drive_file_id, '') <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS meeting_actions_owner_text_live_uq ON meeting_actions (owner_id, lower(trim(text))) WHERE deleted_at IS NULL AND status = 'open'`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS email_boxes_owner_name_live_uq ON email_boxes (owner_id, lower(trim(name))) WHERE deleted_at IS NULL`;
}

/**
 * Read-only: rows the sweep removed that have no live copy now. A row counts as "removed by the sweep"
 * when its removal time is within 2 minutes of the dedupe_log entry, which separates sweep removals from
 * deletes the owner made by hand. `payload` is the full prior row for sweeps after 2026-10-27; older
 * entries hold only {title|name|text, created_at}.
 */
export async function listRestorable(sql: Sql, ownerId: string) {
  const items = await sql`
    SELECT l.id AS log_id, l.created_at AS swept_at, l.dup_key, l.removed_id, l.kept_id, l.payload,
           r.title, r.status AS removed_status, r.due, r.snooze_until, r.updated_at,
           k.status AS kept_status
    FROM dedupe_log l
    JOIN items r ON r.id::text = l.removed_id AND r.owner_id = l.owner_id
    LEFT JOIN items k ON k.id::text = l.kept_id
    WHERE l.owner_id = ${ownerId}
      AND l.table_name = 'items'
      AND r.status = 'dropped'
      AND r.updated_at BETWEEN l.created_at - interval '2 minutes' AND l.created_at + interval '2 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM items x
        WHERE x.owner_id = l.owner_id
          AND lower(trim(x.title)) = l.dup_key
          AND x.status IN ('new', 'doing', 'waiting', 'open')
          AND x.deleted_at IS NULL
          AND (x.snooze_until IS NULL OR x.snooze_until <= now())
      )
    ORDER BY l.created_at DESC
  `;
  let others: Record<string, unknown>[] = [];
  try {
    others = (await sql`
      WITH gone AS (
        SELECT 'notes' AS t, id::text AS id, deleted_at FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        UNION ALL SELECT 'links', id::text, deleted_at FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        UNION ALL SELECT 'contacts', id::text, deleted_at FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        UNION ALL SELECT 'spaces', id::text, deleted_at FROM packages WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        UNION ALL SELECT 'documents', id::text, deleted_at FROM documents WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        UNION ALL SELECT 'meeting_actions', id::text, deleted_at FROM meeting_actions WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
        UNION ALL SELECT 'email_boxes', id::text, deleted_at FROM email_boxes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
      ),
      live AS (
        SELECT 'notes' AS t, id::text AS id FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        UNION ALL SELECT 'links', id::text FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        UNION ALL SELECT 'contacts', id::text FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        UNION ALL SELECT 'spaces', id::text FROM packages WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        UNION ALL SELECT 'documents', id::text FROM documents WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        UNION ALL SELECT 'meeting_actions', id::text FROM meeting_actions WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        UNION ALL SELECT 'email_boxes', id::text FROM email_boxes WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      )
      SELECT l.id AS log_id, l.table_name, l.created_at AS swept_at, l.dup_key, l.removed_id, l.kept_id, l.payload
      FROM dedupe_log l
      JOIN gone g ON g.t = l.table_name AND g.id = l.removed_id
      WHERE l.owner_id = ${ownerId}
        AND l.table_name <> 'items'
        AND g.deleted_at BETWEEN l.created_at - interval '2 minutes' AND l.created_at + interval '2 minutes'
        AND NOT EXISTS (SELECT 1 FROM live v WHERE v.t = l.table_name AND v.id = l.kept_id)
      ORDER BY l.table_name, l.created_at DESC
    `) as Record<string, unknown>[];
  } catch {
    others = [];
  }
  return { items, others, counts: { items: items.length, others: others.length } };
}
