import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

function tidyLayout<T extends { id: unknown; canvas_w?: unknown; canvas_h?: unknown; w?: unknown; h?: unknown }>(notes: T[]) {
  const gap = 24;
  const capW = 360;
  const capH = 300;
  const cols = 4;
  return notes.map((n, i) => {
    const w = Math.max(160, Math.min(capW, Number(n.canvas_w || n.w) || 240));
    const h = Math.max(100, Math.min(capH, Number(n.canvas_h || n.h) || 180));
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: String(n.id),
      x: 80 + col * (capW + gap),
      y: 80 + row * (capH + gap),
      w,
      h,
    };
  });
}

export async function listDeletedBoxes(sql: Sql, ownerId: string) {
  return sql`
    SELECT b.key, b.name, b.org AS "group", b.deleted_at,
      (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = b.owner_id AND a.box_key = b.key AND a.deleted_at IS NULL) AS addr_n,
      (SELECT count(*)::int FROM email_box_tags t WHERE t.owner_id = b.owner_id AND t.box_key = b.key AND t.deleted_at IS NULL) AS tag_n
    FROM email_boxes b
    WHERE b.owner_id = ${ownerId}
      AND b.deleted_at IS NOT NULL
    ORDER BY b.deleted_at, b.name
  `;
}

export async function searchBoxesElsewhere(sql: Sql, ownerId: string) {
  const prefs = await sql`SELECT prefs FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`.catch(() => []);
  const extra = await sql`SELECT key, name, extra FROM email_boxes WHERE owner_id = ${ownerId}`.catch(() => []);
  const hidden = await sql`SELECT sender, created_at FROM email_box_hidden WHERE owner_id = ${ownerId}`.catch(() => []);
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%box%'
    ORDER BY table_name
  `.catch(() => []);
  return { prefs: (prefs as { prefs?: unknown }[])[0]?.prefs || {}, extra, hidden, tables };
}

export async function restoreDeletedBoxes(sql: Sql, ownerId: string) {
  await sql`CREATE TABLE IF NOT EXISTS box_restore_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    keys text NOT NULL DEFAULT '',
    action text NOT NULL DEFAULT '',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  const prior = await listDeletedBoxes(sql, ownerId);
  const keys = (prior as { key?: string }[]).map((r) => String(r.key || '')).filter(Boolean);
  if (!keys.length) return { restored: 0, keys: [], prior };
  await sql`UPDATE email_boxes SET deleted_at = NULL WHERE owner_id = ${ownerId} AND key = ANY(${keys}::text[])`;
  await sql`
    UPDATE email_boxes SET org = 'Team'
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND name ILIKE '%Bruce Fair%' AND (org IS NULL OR org = '' OR org = 'Other')
  `;
  await sql`
    UPDATE email_boxes SET org = 'Legal'
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND name ILIKE '%James Atherton%' AND (org IS NULL OR org = '' OR org = 'Other')
  `;
  await sql`
    INSERT INTO box_restore_log (owner_id, keys, action, payload)
    VALUES (
      ${ownerId}, ${keys.join(',')}, 'restore',
      ${JSON.stringify({ action: 'restore', keys, prior })}::jsonb
    )
  `;
  return { restored: keys.length, keys, prior };
}

export async function applyChadAccountFix(sql: Sql, ownerIds: string[]) {
  const out: Record<string, unknown> = { owners: ownerIds, boxes: [], tidy: [], fpf: [] };
  for (const ownerId of ownerIds) {
    const deleted = await listDeletedBoxes(sql, ownerId);
    const live = await sql`
      SELECT key, name,
        (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = email_boxes.owner_id AND a.box_key = email_boxes.key AND a.deleted_at IS NULL) AS addr_n
      FROM email_boxes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    const restoredKeys = deleted.map((r: { key?: string }) => String(r.key || '')).filter(Boolean);
    if (restoredKeys.length) {
      await sql`UPDATE email_boxes SET deleted_at = NULL WHERE owner_id = ${ownerId} AND key = ANY(${restoredKeys}::text[])`;
      await sql`
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        VALUES (
          ${ownerId}, 'email_boxes', ${restoredKeys.join(',')}, 'restore', 'box_restore_2026-10-26',
          ${JSON.stringify({ action: 'restore', keys: restoredKeys, prior: deleted })}::jsonb
        )
      `;
    }
    const empty = (live as { key?: string; name?: string; addr_n?: number }[]).filter((r) => {
      const key = String(r.key || '');
      const name = String(r.name || '').trim();
      return key === 'n1793051997159' || ((!name || name === 'Box') && Number(r.addr_n) === 0);
    });
    const emptied = empty.map((r) => String(r.key || '')).filter(Boolean);
    if (emptied.length) {
      await sql`UPDATE email_boxes SET deleted_at = now() WHERE owner_id = ${ownerId} AND key = ANY(${emptied}::text[]) AND deleted_at IS NULL`;
      await sql`
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        VALUES (
          ${ownerId}, 'email_boxes', ${emptied.join(',')}, 'soft-delete', 'box_restore_2026-10-26',
          ${JSON.stringify({ action: 'soft-delete-empty', keys: emptied, prior: empty })}::jsonb
        )
      `;
    }
    (out.boxes as unknown[]).push({ ownerId, deleted, restoredKeys, emptied });

    const notes = await sql`
      SELECT id, title, canvas_x, canvas_y, canvas_w, canvas_h FROM notes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    const stickies = await sql`
      SELECT id, x, y, w, h, canvas_x, canvas_y FROM sticky_notes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    const combined = (notes as { id: unknown; canvas_w?: unknown; canvas_h?: unknown }[]).concat(
      (stickies as { id: unknown; w?: unknown; h?: unknown }[]).map((n) => ({
        id: n.id, canvas_w: n.w, canvas_h: n.h, w: n.w, h: n.h,
      }))
    );
    const laidAll = tidyLayout(combined);
    const noteIds = new Set((notes as { id?: string }[]).map((n) => String(n.id)));
    const laidNotes = laidAll.filter((n) => noteIds.has(n.id));
    const laidStick = laidAll.filter((n) => !noteIds.has(n.id));
    for (const n of laidNotes) {
      await sql`
        UPDATE notes SET canvas_x = ${n.x}, canvas_y = ${n.y}, canvas_w = ${n.w}, canvas_h = ${n.h}
        WHERE id = ${n.id}::uuid AND owner_id = ${ownerId}
      `;
    }
    for (const n of laidStick) {
      await sql`
        UPDATE sticky_notes SET x = ${n.x}, y = ${n.y}, w = ${n.w}, h = ${n.h}, canvas_x = ${n.x}, canvas_y = ${n.y}
        WHERE id = ${n.id}::uuid AND owner_id = ${ownerId}
      `;
    }
    await sql`
      INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
      VALUES (
        ${ownerId}, 'notes', 'canvas', 'tidy', 'canvas_tidy_2026-10-26',
        ${JSON.stringify({ action: 'tidy', board: notes, sticky: stickies, laidNotes, laidStick })}::jsonb
      )
    `;
    (out.tidy as unknown[]).push({ ownerId, notes: laidNotes.length, stickies: laidStick.length });

    const fpf = await sql`
      SELECT id, seed_key, title, status_override FROM timeline_items
      WHERE owner_id = ${ownerId} AND archived_at IS NULL
        AND (seed_key = 'fpf' OR title ILIKE '%Fraud Prevention Forum%')
    `;
    for (const row of fpf as { id?: string; seed_key?: string; status_override?: string }[]) {
      if (String(row.status_override || '') === 'done') continue;
      await sql`UPDATE timeline_items SET status_override = 'done' WHERE id = ${String(row.id)}::uuid AND owner_id = ${ownerId}`;
      await sql`
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        VALUES (
          ${ownerId}, 'timeline_items', ${String(row.seed_key || row.id)}, 'st-done', 'fpf_done_2026-10-26',
          ${JSON.stringify({ action: 'set-done', prior: row.status_override || '' })}::jsonb
        )
      `;
      (out.fpf as unknown[]).push({ ownerId, id: row.id, prior: row.status_override || '' });
    }
  }
  return out;
}

const CLAUDE_TEST_ITEMS = [
  '4100c5f1-5d60-495e-a8ee-3b4d47ee3428',
  '40720c50-b448-4a49-9c4a-5b2bd4b4bf41',
];

const JUNK_BOX_KEY = 'n1793051997159';

export async function archiveJunkBox(sql: Sql, ownerId: string) {
  await sql`CREATE TABLE IF NOT EXISTS box_restore_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    keys text NOT NULL DEFAULT '',
    action text NOT NULL DEFAULT '',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  const prior = await sql`
    SELECT key, name, org, deleted_at,
      (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = email_boxes.owner_id AND a.box_key = email_boxes.key AND a.deleted_at IS NULL) AS addr_n
    FROM email_boxes
    WHERE owner_id = ${ownerId} AND key = ${JUNK_BOX_KEY}
  `;
  if (!prior.length) return { archived: 0, prior };
  await sql`
    UPDATE email_boxes SET deleted_at = now()
    WHERE owner_id = ${ownerId} AND key = ${JUNK_BOX_KEY} AND deleted_at IS NULL
  `;
  await sql`
    INSERT INTO box_restore_log (owner_id, keys, action, payload)
    VALUES (
      ${ownerId}, ${JUNK_BOX_KEY}, 'archive-junk-j',
      ${JSON.stringify({ action: 'archive-junk-j', prior })}::jsonb
    )
  `;
  return { archived: 1, prior };
}

export async function importSnapshotBoxes(sql: Sql, ownerId: string, rows: Record<string, unknown>[]) {
  await sql`CREATE TABLE IF NOT EXISTS box_restore_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    keys text NOT NULL DEFAULT '',
    action text NOT NULL DEFAULT '',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  const keys: string[] = [];
  for (const raw of rows) {
    const key = String(raw.key || raw.id || '').slice(0, 40);
    if (!key || key === JUNK_BOX_KEY) continue;
    const name = String(raw.name || raw.n || 'Box').slice(0, 80);
    const org = String(raw.org || raw.o || raw.group || '').slice(0, 120);
    const color = String(raw.color || raw.c || '#2e6bf2').slice(0, 16);
    const extra = JSON.stringify(raw.extra && typeof raw.extra === 'object' ? raw.extra : raw);
    const addrs = Array.isArray(raw.addrs) ? raw.addrs.map((e) => String(e || '').toLowerCase()).filter(Boolean) : [];
    const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t || '').toLowerCase()).filter(Boolean) : [];
    keys.push(key);
    await sql`
      INSERT INTO email_boxes (owner_id, key, name, org, color, closed, position, extra)
      VALUES (${ownerId}, ${key}, ${name}, ${org}, ${color}, ${!!raw.closed}, ${Number(raw.position) || 0}, ${extra}::jsonb)
      ON CONFLICT (owner_id, key) DO UPDATE SET
        name = EXCLUDED.name, org = EXCLUDED.org, color = EXCLUDED.color,
        extra = EXCLUDED.extra, deleted_at = NULL
    `;
    if (addrs.length) {
      await sql`
        INSERT INTO email_box_addresses (owner_id, box_key, email)
        SELECT ${ownerId}, ${key}, e FROM unnest(${addrs}::text[]) AS e
        ON CONFLICT (owner_id, box_key, email) DO UPDATE SET deleted_at = NULL
      `;
    }
    if (tags.length) {
      await sql`
        INSERT INTO email_box_tags (owner_id, box_key, tag)
        SELECT ${ownerId}, ${key}, t FROM unnest(${tags}::text[]) AS t
        ON CONFLICT (owner_id, box_key, tag) DO UPDATE SET deleted_at = NULL
      `;
    }
  }
  await sql`
    UPDATE email_boxes SET org = 'Team'
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND name ILIKE '%Bruce Fair%' AND (org IS NULL OR org = '' OR org = 'Other')
  `;
  await sql`
    UPDATE email_boxes SET org = 'Legal'
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND name ILIKE '%James Atherton%' AND (org IS NULL OR org = '' OR org = 'Other')
  `;
  await sql`
    INSERT INTO box_restore_log (owner_id, keys, action, payload)
    VALUES (
      ${ownerId}, ${keys.join(',')}, 'import-pitr',
      ${JSON.stringify({ action: 'import-pitr', keys, n: keys.length })}::jsonb
    )
  `;
  return { imported: keys.length, keys };
}

export async function listRestoreLogs(sql: Sql, ownerId: string) {
  return sql`
    SELECT action, keys, created_at, payload
    FROM box_restore_log WHERE owner_id = ${ownerId}
    ORDER BY created_at DESC LIMIT 20
  `.catch(() => []);
}

export async function archiveClaudeTestItems(sql: Sql, ownerId: string) {
  const prior = await sql`
    SELECT id, title, status FROM items
    WHERE owner_id = ${ownerId} AND id = ANY(${CLAUDE_TEST_ITEMS}::uuid[])
  `;
  if (!prior.length) return { archived: 0, prior };
  await sql`
    UPDATE items SET status = 'dropped', deleted_at = now(), updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ANY(${CLAUDE_TEST_ITEMS}::uuid[]) AND status <> 'dropped'
  `;
  await sql`
    INSERT INTO box_restore_log (owner_id, keys, action, payload)
    VALUES (
      ${ownerId}, ${CLAUDE_TEST_ITEMS.join(',')}, 'archive-claude-tests',
      ${JSON.stringify({ action: 'archive', prior })}::jsonb
    )
  `.catch(() => null);
  return { archived: prior.length, prior };
}

export async function chadDoneCounts(sql: Sql, ownerId: string) {
  const items = await sql`
    SELECT id, title, status, due, updated_at, area
    FROM items
    WHERE owner_id = ${ownerId} AND status <> 'dropped'
  `;
  const timeline = await sql`
    SELECT seed_key, title, status_override, start_date, due_date, kind
    FROM timeline_items
    WHERE owner_id = ${ownerId} AND archived_at IS NULL
  `;
  return { items, timeline };
}
