import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

export type DupeRow = { id: string; label: string; created_at: string | null };
export type DupeGroup = { key: string; keep: DupeRow; remove: DupeRow[] };

function asRow(row: Record<string, unknown>): DupeRow {
  return {
    id: String(row.id),
    label: String(row.label || row.title || row.name || row.url || row.email || row.text || row.key || ''),
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

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
  const items = await sql`
    SELECT id, title AS label, created_at, lower(trim(title)) AS k
    FROM items
    WHERE owner_id = ${ownerId} AND status <> 'dropped' AND trim(title) <> ''
    ORDER BY created_at ASC, id ASC
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
  const tables = {
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

async function logRow(sql: Sql, ownerId: string, table: string, keptId: string, removedId: string, key: string, payload: Record<string, unknown>) {
  await sql`
    INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
    VALUES (${ownerId}, ${table}, ${keptId}, ${removedId}, ${key}, ${JSON.stringify(payload)}::jsonb)
  `;
}

export async function applyDedupe(sql: Sql, ownerId: string) {
  const listed = await listDupeGroups(sql, ownerId);
  const applied: Record<string, number> = {};
  for (const g of listed.tables.items) {
    for (const row of g.remove) {
      await sql`UPDATE items SET status = 'dropped', updated_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId}`;
      await logRow(sql, ownerId, 'items', g.keep.id, row.id, g.key, { title: row.label, created_at: row.created_at });
    }
    applied.items = (applied.items || 0) + g.remove.length;
  }
  for (const g of listed.tables.notes) {
    for (const row of g.remove) {
      await sql`UPDATE notes SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'notes', g.keep.id, row.id, g.key, { title: row.label, created_at: row.created_at });
    }
    applied.notes = (applied.notes || 0) + g.remove.length;
  }
  for (const g of listed.tables.links) {
    for (const row of g.remove) {
      await sql`UPDATE links SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'links', g.keep.id, row.id, g.key, { title: row.label, created_at: row.created_at });
    }
    applied.links = (applied.links || 0) + g.remove.length;
  }
  for (const g of listed.tables.contacts) {
    for (const row of g.remove) {
      await sql`UPDATE contacts SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'contacts', g.keep.id, row.id, g.key, { name: row.label, created_at: row.created_at });
    }
    applied.contacts = (applied.contacts || 0) + g.remove.length;
  }
  for (const g of listed.tables.spaces) {
    for (const row of g.remove) {
      await sql`UPDATE packages SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'spaces', g.keep.id, row.id, g.key, { name: row.label, created_at: row.created_at });
    }
    applied.spaces = (applied.spaces || 0) + g.remove.length;
  }
  for (const g of listed.tables.documents) {
    for (const row of g.remove) {
      await sql`UPDATE documents SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'documents', g.keep.id, row.id, g.key, { name: row.label, created_at: row.created_at });
    }
    applied.documents = (applied.documents || 0) + g.remove.length;
  }
  for (const g of listed.tables.meeting_actions) {
    for (const row of g.remove) {
      await sql`UPDATE meeting_actions SET deleted_at = now(), status = 'handled' WHERE id = ${row.id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'meeting_actions', g.keep.id, row.id, g.key, { text: row.label, created_at: row.created_at });
    }
    applied.meeting_actions = (applied.meeting_actions || 0) + g.remove.length;
  }
  for (const g of listed.tables.email_boxes) {
    for (const row of g.remove) {
      await sql`UPDATE email_boxes SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await logRow(sql, ownerId, 'email_boxes', g.keep.id, row.id, g.key, { name: row.label, created_at: row.created_at });
    }
    applied.email_boxes = (applied.email_boxes || 0) + g.remove.length;
  }
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS items_owner_title_live_uq ON items (owner_id, lower(trim(title))) WHERE status <> 'dropped' AND trim(title) <> ''`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS notes_owner_title_body_live_uq ON notes (owner_id, lower(trim(title)), md5(coalesce(body, ''))) WHERE deleted_at IS NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS links_owner_url_live_uq ON links (owner_id, lower(trim(url))) WHERE deleted_at IS NULL AND trim(url) <> ''`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_email_live_uq ON contacts (owner_id, lower(trim(email))) WHERE deleted_at IS NULL AND coalesce(trim(email), '') <> ''`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS packages_owner_name_live_uq ON packages (owner_id, lower(trim(name))) WHERE deleted_at IS NULL AND trim(name) <> ''`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS documents_owner_drive_live_uq ON documents (owner_id, drive_file_id) WHERE deleted_at IS NULL AND coalesce(drive_file_id, '') <> ''`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS meeting_actions_owner_text_live_uq ON meeting_actions (owner_id, lower(trim(text))) WHERE deleted_at IS NULL AND status = 'open'`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS email_boxes_owner_name_live_uq ON email_boxes (owner_id, lower(trim(name))) WHERE deleted_at IS NULL`;
  } catch (err) {
    /* unique indexes apply after the sweep; leftover exact dups would block */
  }
  return { before: listed.counts, applied };
}
