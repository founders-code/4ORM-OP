import { neon } from '@neondatabase/serverless';
import { loadLocalEnv } from './load-local-env.mjs';
import { openSeal } from '../lib/seal.mjs';

loadLocalEnv();
const APPLY = process.argv.includes('--apply');

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL;
  }
  const secret = process.env.CLERK_SECRET_KEY || '';
  if (!secret) return '';
  const res = await fetch('https://api.clerk.com/v1/users?email_address=' + encodeURIComponent('chad@4ormfinance.com') + '&limit=1', {
    headers: { Authorization: 'Bearer ' + secret },
  });
  if (!res.ok) return '';
  const users = await res.json();
  const list = Array.isArray(users) ? users : (users.data || []);
  const packed = list[0] && list[0].private_metadata && list[0].private_metadata.seal;
  if (!packed) return '';
  const plain = openSeal(packed, process.env.ENCRYPTION_KEY || secret);
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

async function chadOwners() {
  const ids = new Set();
  const room = await sql`SELECT email, owner_id FROM room_owner WHERE lower(email) = 'chad@4ormfinance.com'`;
  room.forEach((r) => { if (r.owner_id) ids.add(String(r.owner_id)); });
  if (process.env.CONTROL_ROOM_OWNER_ID) ids.add(process.env.CONTROL_ROOM_OWNER_ID);
  const secret = process.env.CLERK_SECRET_KEY || '';
  if (secret) {
    const res = await fetch('https://api.clerk.com/v1/users?email_address=' + encodeURIComponent('chad@4ormfinance.com') + '&limit=1', {
      headers: { Authorization: 'Bearer ' + secret },
    });
    if (res.ok) {
      const users = await res.json();
      const list = Array.isArray(users) ? users : (users.data || []);
      if (list[0]?.id) ids.add(String(list[0].id));
    }
  }
  return [...ids];
}

function tidyLayout(notes) {
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

async function main() {
  const owners = await chadOwners();
  console.log('chad_owners', owners);
  if (!owners.length) throw new Error('No Chad owner_id');

  for (const ownerId of owners) {
    const deleted = await sql`
      SELECT b.key, b.name, b.deleted_at,
        (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = b.owner_id AND a.box_key = b.key AND a.deleted_at IS NULL) AS addr_n,
        (SELECT count(*)::int FROM email_box_tags t WHERE t.owner_id = b.owner_id AND t.box_key = b.key AND t.deleted_at IS NULL) AS tag_n
      FROM email_boxes b
      WHERE b.owner_id = ${ownerId}
        AND b.deleted_at IS NOT NULL
        AND b.deleted_at::date = DATE '2026-10-26'
      ORDER BY b.deleted_at, b.name
    `;
    const live = await sql`
      SELECT key, name, deleted_at,
        (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = email_boxes.owner_id AND a.box_key = email_boxes.key AND a.deleted_at IS NULL) AS addr_n,
        (SELECT count(*)::int FROM email_box_tags t WHERE t.owner_id = email_boxes.owner_id AND t.box_key = email_boxes.key AND t.deleted_at IS NULL) AS tag_n
      FROM email_boxes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY name
    `;
    console.log('\n=== FAULT A deleted 2026-10-26 owner', ownerId, 'n=', deleted.length, '===');
    deleted.forEach((r) => {
      console.log([r.key, JSON.stringify(r.name), r.deleted_at, 'addrs=' + r.addr_n, 'tags=' + r.tag_n].join('\t'));
    });
    console.log('live_boxes', live.length, live.map((r) => r.key + ':' + JSON.stringify(r.name) + ':a' + r.addr_n).join(' | '));

    const notes = await sql`
      SELECT id, title, canvas_x, canvas_y, canvas_w, canvas_h FROM notes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    const stickies = await sql`
      SELECT id, x, y, w, h, canvas_x, canvas_y, meta FROM sticky_notes
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    const links = await sql`SELECT count(*)::int AS n FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NULL`;
    const fpf = await sql`SELECT seed_key, title, status_override, due_date FROM timeline_items WHERE owner_id = ${ownerId} AND (seed_key = 'fpf' OR title ILIKE '%Fraud Prevention Forum%')`;
    const red = await sql`
      SELECT seed_key, title, kind, status_override, start_date, due_date
      FROM timeline_items
      WHERE owner_id = ${ownerId} AND archived_at IS NULL
        AND coalesce(status_override, '') <> 'done'
        AND due_date IS NOT NULL AND due_date < DATE '2026-10-26'
        AND (kind IS NULL OR kind NOT IN ('recurring'))
      ORDER BY due_date
    `;
    const doneItems = await sql`
      SELECT count(*)::int AS n FROM items
      WHERE owner_id = ${ownerId} AND status = 'done' AND updated_at >= now() - interval '30 days'
    `;
    const snaps = await sql`
      SELECT snap_date FROM daily_snapshots
      WHERE owner_id = ${ownerId}
      ORDER BY snap_date DESC LIMIT 12
    `.catch(() => []);
    console.log('notes', notes.length, 'stickies', stickies.length, 'links', links[0]?.n, 'done30', doneItems[0]?.n);
    console.log('fpf', JSON.stringify(fpf));
    console.log('past_due_not_done', red.length, red.map((r) => r.seed_key + ':' + r.title + ':' + r.due_date).join(' | '));
    console.log('snaps', (snaps || []).length);

    if (!APPLY) continue;

    const restoredKeys = [];
    for (const row of deleted) {
      await sql`UPDATE email_boxes SET deleted_at = NULL WHERE owner_id = ${ownerId} AND key = ${row.key}`;
      restoredKeys.push(row.key);
    }
    if (restoredKeys.length) {
      await sql`
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        VALUES (
          ${ownerId}, 'email_boxes', ${restoredKeys.join(',')}, 'restore', 'box_restore_2026-10-26',
          ${JSON.stringify({ action: 'restore', keys: restoredKeys, prior: deleted })}::jsonb
        )
      `;
    }
    const empty = live.filter((r) => r.key === 'n1793051997159' || ((!r.name || r.name === 'Box') && Number(r.addr_n) === 0));
    const emptied = [];
    for (const row of empty) {
      await sql`UPDATE email_boxes SET deleted_at = now() WHERE owner_id = ${ownerId} AND key = ${row.key} AND deleted_at IS NULL`;
      emptied.push(row.key);
    }
    if (emptied.length) {
      await sql`
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        VALUES (
          ${ownerId}, 'email_boxes', ${emptied.join(',')}, 'soft-delete', 'box_restore_2026-10-26',
          ${JSON.stringify({ action: 'soft-delete-empty', keys: emptied, prior: empty })}::jsonb
        )
      `;
    }
    console.log('restored', restoredKeys.length, 'soft_deleted_empty', emptied);

    const boardOld = notes.map((n) => ({
      id: n.id, canvas_x: n.canvas_x, canvas_y: n.canvas_y, canvas_w: n.canvas_w, canvas_h: n.canvas_h, store: 'board',
    }));
    const stickyOld = stickies.map((n) => ({
      id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, canvas_x: n.canvas_x, canvas_y: n.canvas_y, store: 'sticky',
    }));
    const laidNotes = tidyLayout(notes);
    const laidStick = tidyLayout(stickies.map((n) => ({
      id: n.id, canvas_w: n.w, canvas_h: n.h, w: n.w, h: n.h,
    })));
    for (const n of laidNotes) {
      await sql`
        UPDATE notes SET canvas_x = ${n.x}, canvas_y = ${n.y}, canvas_w = ${n.w}, canvas_h = ${n.h}, updated_at = updated_at
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
        ${JSON.stringify({ action: 'tidy', board: boardOld, sticky: stickyOld, laidNotes, laidStick })}::jsonb
      )
    `;
    console.log('tidied notes', laidNotes.length, 'stickies', laidStick.length);

    for (const row of fpf) {
      if (String(row.status_override || '') === 'done') continue;
      await sql`
        UPDATE timeline_items SET status_override = 'done'
        WHERE owner_id = ${ownerId} AND id IN (
          SELECT id FROM timeline_items WHERE owner_id = ${ownerId} AND (seed_key = 'fpf' OR title ILIKE '%Fraud Prevention Forum%')
        )
      `;
      await sql`
        INSERT INTO dedupe_log (owner_id, table_name, kept_id, removed_id, dup_key, payload)
        VALUES (
          ${ownerId}, 'timeline_items', ${String(row.seed_key || row.title)}, 'st-done', 'fpf_done_2026-10-26',
          ${JSON.stringify({ action: 'set-done', prior: row.status_override || '' })}::jsonb
        )
      `;
      console.log('fpf status set done, prior=', row.status_override);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
