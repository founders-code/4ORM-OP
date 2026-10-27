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
    SELECT b.key, b.name, b.deleted_at,
      (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = b.owner_id AND a.box_key = b.key AND a.deleted_at IS NULL) AS addr_n,
      (SELECT count(*)::int FROM email_box_tags t WHERE t.owner_id = b.owner_id AND t.box_key = b.key AND t.deleted_at IS NULL) AS tag_n
    FROM email_boxes b
    WHERE b.owner_id = ${ownerId}
      AND b.deleted_at IS NOT NULL
      AND b.deleted_at >= TIMESTAMPTZ '2026-10-26 00:00:00+00'
      AND b.key <> 'n1793051997159'
    ORDER BY b.deleted_at, b.name
  `;
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
