import { neon } from '@neondatabase/serverless';

const APPLY = process.argv.includes('--apply');
const CLUSTER = 'd1fa61d7-8f49-48d1-b62d-3ffd8bb976fa';

function url() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

const db = url();
if (!db) {
  console.error('Need DATABASE_URL (run via vercel env run -e production)');
  process.exit(1);
}
const sql = neon(db);

async function owners() {
  const ids = new Set();
  const room = await sql`SELECT owner_id FROM room_owner WHERE lower(email) = 'chad@4ormfinance.com'`;
  room.forEach((r) => { if (r.owner_id) ids.add(String(r.owner_id)); });
  const cl = await sql`SELECT owner_id FROM note_clusters WHERE id = ${CLUSTER}`;
  cl.forEach((r) => { if (r.owner_id) ids.add(String(r.owner_id)); });
  if (process.env.CONTROL_ROOM_OWNER_ID) ids.add(process.env.CONTROL_ROOM_OWNER_ID);
  return [...ids];
}

async function main() {
  const cl = await sql`
    SELECT id, owner_id, name, x, y, w, h, deleted_at,
           to_char(created_at AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD HH24:MI:SS') AS created_van
    FROM note_clusters WHERE id = ${CLUSTER}
  `;
  console.log('cluster', cl.map((r) => ({
    id: r.id, name: r.name, created_van: r.created_van, deleted: !!r.deleted_at,
    owner: String(r.owner_id).slice(0, 10),
  })));
  const ids = await owners();
  if (!ids.length) {
    console.log('no chad owner ids');
    process.exit(1);
  }
  let restore = [];
  for (const ownerId of ids) {
    const live = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL`;
    const gone = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL`;
    const all = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId}`;
    const slive = await sql`SELECT count(*)::int AS n FROM sticky_notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL`;
    const sgone = await sql`SELECT count(*)::int AS n FROM sticky_notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL`;
    const liveTitles = await sql`SELECT title FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50`;
    const goneTitles = await sql`SELECT title FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 80`;
    console.log('owner', String(ownerId).slice(0, 10), {
      notes_live: live[0].n, notes_deleted: gone[0].n, notes_all: all[0].n,
      sticky_live: slive[0].n, sticky_deleted: sgone[0].n,
    });
    console.log('live titles', liveTitles.map((t) => t.title));
    console.log('deleted titles', goneTitles.map((t) => t.title));
    restore.push({ ownerId, gone: gone[0].n, stickyGone: sgone[0].n });
  }
  console.log('NEON_API_KEY', process.env.NEON_API_KEY || process.env.NEON_API_TOKEN ? 'set' : 'missing');
  console.log('NEON_PROJECT_ID', process.env.NEON_PROJECT_ID ? 'set' : 'missing');
  if (!APPLY) {
    console.log('dry run; pass --apply to undelete rows on main (does not touch live rows)');
    return;
  }
  for (const row of restore) {
    if (row.gone) {
      const back = await sql`
        UPDATE notes SET deleted_at = NULL, updated_at = now()
        WHERE owner_id = ${row.ownerId} AND deleted_at IS NOT NULL
        RETURNING id, title
      `;
      console.log('restored notes', back.length, back.map((n) => n.title).slice(0, 40));
    }
    if (row.stickyGone) {
      const back = await sql`
        UPDATE sticky_notes SET deleted_at = NULL
        WHERE owner_id = ${row.ownerId} AND deleted_at IS NOT NULL
        RETURNING id
      `;
      console.log('restored sticky', back.length);
    }
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
