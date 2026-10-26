import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { openSeal } from '../lib/seal.mjs';

const APPLY = process.argv.includes('--apply');
const envFile = process.argv.find((a) => a.startsWith('--env='))?.slice(6) || '.env.local';
if (envFile) {
  try {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch { /* optional */ }
}

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL;
  }
  const secret = process.env.CLERK_SECRET_KEY || '';
  if (!secret) return '';
  const qs = new URLSearchParams({ email_address: ['chad@4ormfinance.com'], limit: '1' });
  const res = await fetch('https://api.clerk.com/v1/users?' + qs.toString(), {
    headers: { Authorization: 'Bearer ' + secret },
  });
  if (!res.ok) return '';
  const users = await res.json();
  const list = Array.isArray(users) ? users : (users.data || []);
  const packed = list[0] && list[0].private_metadata && list[0].private_metadata.seal;
  if (!packed) return '';
  const material = process.env.ENCRYPTION_KEY || secret;
  const plain = openSeal(packed, material);
  if (!plain) return '';
  try {
    const bag = JSON.parse(plain);
    return bag.databaseUrl || '';
  } catch {
    return '';
  }
}

const url = await resolveDatabaseUrl();
if (!url) {
  console.error('Need DATABASE_URL');
  process.exit(1);
}
process.env.DATABASE_URL = url;

const sql = neon(url);

function group(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.k || '');
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  const out = [];
  for (const [key, list] of map) {
    if (list.length < 2) continue;
    out.push({
      key,
      keep: { id: list[0].id, label: list[0].label, created_at: list[0].created_at },
      remove: list.slice(1).map((r) => ({ id: r.id, label: r.label, created_at: r.created_at })),
    });
  }
  return out.sort((a, b) => b.remove.length - a.remove.length || String(a.key).localeCompare(String(b.key)));
}

async function ensure() {
  await sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE meeting_actions ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`ALTER TABLE email_boxes ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
  await sql`CREATE TABLE IF NOT EXISTS dedupe_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    table_name text NOT NULL,
    kept_id text NOT NULL,
    removed_id text NOT NULL,
    dup_key text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
}

async function chadOwner() {
  const room = await sql`SELECT owner_id FROM room_owner WHERE email = 'chad@4ormfinance.com' LIMIT 1`;
  if (room[0]?.owner_id) return String(room[0].owner_id);
  const fixed = process.env.CONTROL_ROOM_OWNER_ID;
  if (fixed) return fixed;
  throw new Error('No Chad owner_id');
}

async function listGroups(ownerId) {
  const items = await sql`
    SELECT id, title AS label, created_at, lower(trim(title)) AS k
    FROM items WHERE owner_id = ${ownerId} AND status <> 'dropped' AND trim(title) <> ''
    ORDER BY created_at ASC, id ASC`;
  const notes = await sql`
    SELECT id, title AS label, created_at, (lower(trim(title)) || E'\n' || md5(coalesce(body, ''))) AS k
    FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(title) <> ''
    ORDER BY created_at ASC, id ASC`;
  const links = await sql`
    SELECT id, title AS label, created_at, lower(trim(url)) AS k
    FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(url) <> ''
    ORDER BY created_at ASC, id ASC`;
  const contacts = await sql`
    SELECT id, name AS label, created_at, lower(trim(email)) AS k
    FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND coalesce(trim(email), '') <> ''
    ORDER BY created_at ASC, id ASC`;
  const spaces = await sql`
    SELECT id, name AS label, created_at, lower(trim(name)) AS k
    FROM packages WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(name) <> ''
    ORDER BY created_at ASC, id ASC`;
  const documents = await sql`
    SELECT id, name AS label, created_at, drive_file_id AS k
    FROM documents WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND coalesce(drive_file_id, '') <> ''
    ORDER BY created_at ASC, id ASC`;
  let meeting = [];
  try {
    meeting = await sql`
      SELECT id, text AS label, created_at, lower(trim(text)) AS k
      FROM meeting_actions WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND status = 'open' AND trim(text) <> ''
      ORDER BY created_at ASC, id ASC`;
  } catch (e) { meeting = []; }
  const boxes = await sql`
    SELECT id, name AS label, created_at, lower(trim(name)) AS k
    FROM email_boxes WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND trim(name) <> ''
    ORDER BY created_at ASC, id ASC`;
  const tables = {
    items: group(items),
    notes: group(notes),
    links: group(links),
    contacts: group(contacts),
    spaces: group(spaces),
    documents: group(documents),
    meeting_actions: group(meeting),
    email_boxes: group(boxes),
  };
  const counts = {};
  for (const [name, groups] of Object.entries(tables)) {
    counts[name] = groups.reduce((n, g) => n + g.remove.length, 0);
  }
  return { tables, counts };
}

async function apply(ownerId, listed) {
  for (const g of listed.tables.items) {
    for (const row of g.remove) {
      await sql`UPDATE items SET status = 'dropped', updated_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId}`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'items', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.notes) {
    for (const row of g.remove) {
      await sql`UPDATE notes SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'notes', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.links) {
    for (const row of g.remove) {
      await sql`UPDATE links SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'links', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.contacts) {
    for (const row of g.remove) {
      await sql`UPDATE contacts SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'contacts', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.spaces) {
    for (const row of g.remove) {
      await sql`UPDATE packages SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'spaces', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.documents) {
    for (const row of g.remove) {
      await sql`UPDATE documents SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'documents', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.meeting_actions) {
    for (const row of g.remove) {
      await sql`UPDATE meeting_actions SET deleted_at = now(), status = 'handled' WHERE id = ${row.id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'meeting_actions', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  for (const g of listed.tables.email_boxes) {
    for (const row of g.remove) {
      await sql`UPDATE email_boxes SET deleted_at = now() WHERE id = ${row.id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
      await sql`INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload) VALUES (${ownerId}, 'email_boxes', ${g.keep.id}, ${row.id}, ${g.key}, ${JSON.stringify(row)}::jsonb)`;
    }
  }
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS items_owner_title_live_uq ON items (owner_id, lower(trim(title))) WHERE status <> 'dropped' AND trim(title) <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS notes_owner_title_body_live_uq ON notes (owner_id, lower(trim(title)), md5(coalesce(body, ''))) WHERE deleted_at IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS links_owner_url_live_uq ON links (owner_id, lower(trim(url))) WHERE deleted_at IS NULL AND trim(url) <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_email_live_uq ON contacts (owner_id, lower(trim(email))) WHERE deleted_at IS NULL AND coalesce(trim(email), '') <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS packages_owner_name_live_uq ON packages (owner_id, lower(trim(name))) WHERE deleted_at IS NULL AND trim(name) <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS documents_owner_drive_live_uq ON documents (owner_id, drive_file_id) WHERE deleted_at IS NULL AND coalesce(drive_file_id, '') <> ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS meeting_actions_owner_text_live_uq ON meeting_actions (owner_id, lower(trim(text))) WHERE deleted_at IS NULL AND status = 'open'`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS email_boxes_owner_name_live_uq ON email_boxes (owner_id, lower(trim(name))) WHERE deleted_at IS NULL`;
}

const ownerId = await chadOwner();
await ensure();
const listed = await listGroups(ownerId);
console.log(JSON.stringify({
  dry: !APPLY,
  owner: 'chad',
  ownerId: ownerId.slice(0, 8) + '…',
  counts: listed.counts,
  groupCounts: Object.fromEntries(Object.entries(listed.tables).map(([k, v]) => [k, v.length])),
  first15: Object.entries(listed.tables).flatMap(([table, groups]) => groups.map((g) => ({
    table,
    title: g.keep.label,
    keepAt: g.keep.created_at,
    removeAt: g.remove.map((r) => r.created_at),
    remove: g.remove.length,
  }))).slice(0, 15),
}, null, 2));
if (APPLY) {
  await apply(ownerId, listed);
  const after = await listGroups(ownerId);
  const leftover = await sql`
    SELECT title, count(*)::int AS n FROM items
    WHERE owner_id = ${ownerId} AND status <> 'dropped'
      AND (
        lower(title) LIKE 'open the next private-network conversation with kevin%'
        OR lower(title) LIKE 'write who, the chunk%'
        OR lower(title) LIKE 'then open zahar, bj, and daryl%'
      )
    GROUP BY title ORDER BY n DESC
  `;
  const leftoverActs = await sql`
    SELECT text, count(*)::int AS n FROM meeting_actions
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND status = 'open'
      AND (
        lower(text) LIKE 'open the next private-network conversation with kevin%'
        OR lower(text) LIKE 'write who, the chunk%'
        OR lower(text) LIKE 'then open zahar, bj, and daryl%'
      )
    GROUP BY text ORDER BY n DESC
  `;
  console.log(JSON.stringify({ applied: listed.counts, leftoverAfter: after.counts, warCards: leftover, warActions: leftoverActs }, null, 2));
}
