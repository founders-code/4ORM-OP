import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;
const ID = /^[0-9a-f-]{36}$/i;

export async function ensureNoteCanvas(sql: Sql) {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['db_note_clusters', () => sql`CREATE TABLE IF NOT EXISTS note_clusters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL DEFAULT 'New cluster',
      color text NOT NULL DEFAULT '#2e6bf2',
      x int NOT NULL DEFAULT 120,
      y int NOT NULL DEFAULT 120,
      w int NOT NULL DEFAULT 500,
      h int NOT NULL DEFAULT 300,
      position int NOT NULL DEFAULT 0,
      deleted_at timestamptz,
      created_at timestamptz DEFAULT now()
    )`],
    ['db_note_clusters_created_at', () => sql`ALTER TABLE note_clusters ADD COLUMN IF NOT EXISTS created_at timestamptz`],
    ['db_notes_canvas_x', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS canvas_x int`],
    ['db_notes_canvas_y', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS canvas_y int`],
    ['db_notes_cluster_id', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS cluster_id uuid`],
    ['db_notes_canvas_w', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS canvas_w int`],
    ['db_notes_canvas_h', () => sql`ALTER TABLE notes ADD COLUMN IF NOT EXISTS canvas_h int`],
    ['db_sticky_canvas_x', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS canvas_x int`],
    ['db_sticky_canvas_y', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS canvas_y int`],
    ['db_sticky_cluster_id', () => sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS cluster_id uuid`],
  ];
  for (const [code, run] of steps) {
    try {
      await run();
    } catch (err) {
      fail(code, err);
    }
  }
}

function clip(v: unknown, n: number) {
  return String(v ?? '').trim().slice(0, n);
}

export async function listClusters(sql: Sql, ownerId: string) {
  await ensureNoteCanvas(sql);
  const rows = await sql`
    SELECT id, name, color, x, y, w, h, position
    FROM note_clusters
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    ORDER BY position, name
  `;
  return rows as Array<Record<string, unknown>>;
}

export async function createCluster(sql: Sql, ownerId: string, body: Record<string, unknown>) {
  await ensureNoteCanvas(sql);
  const name = clip(body.name, 80) || 'New cluster';
  const color = clip(body.color, 16) || '#2e6bf2';
  const x = Number.isFinite(Number(body.x)) ? Math.round(Number(body.x)) : 120;
  const y = Number.isFinite(Number(body.y)) ? Math.round(Number(body.y)) : 120;
  const w = Number.isFinite(Number(body.w)) ? Math.max(260, Math.round(Number(body.w))) : 500;
  const h = Number.isFinite(Number(body.h)) ? Math.max(200, Math.round(Number(body.h))) : 300;
  const rows = await sql`
    INSERT INTO note_clusters (owner_id, name, color, x, y, w, h)
    VALUES (${ownerId}, ${name}, ${color}, ${x}, ${y}, ${w}, ${h})
    RETURNING id, name, color, x, y, w, h, position
  `;
  const made = rows[0] as { id?: string } | undefined;
  const rawIds = Array.isArray(body.noteIds) ? body.noteIds : Array.isArray(body.ids) ? body.ids : [];
  const noteIds = rawIds.map((x) => String(x)).filter((id) => ID.test(id));
  if (made?.id && noteIds.length) {
    await sql`
      UPDATE notes SET cluster_id = ${String(made.id)}::uuid, updated_at = now()
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND id = ANY(${noteIds}::uuid[])
    `;
  }
  return rows[0] || null;
}

export async function patchCluster(sql: Sql, ownerId: string, id: string, body: Record<string, unknown>) {
  if (!ID.test(id)) return null;
  await ensureNoteCanvas(sql);
  const name = Object.prototype.hasOwnProperty.call(body, 'name') ? (clip(body.name, 80) || 'Untitled cluster') : null;
  const color = Object.prototype.hasOwnProperty.call(body, 'color') ? (clip(body.color, 16) || '#2e6bf2') : null;
  const x = Number.isFinite(Number(body.x)) ? Math.round(Number(body.x)) : null;
  const y = Number.isFinite(Number(body.y)) ? Math.round(Number(body.y)) : null;
  const w = Number.isFinite(Number(body.w)) ? Math.max(260, Math.round(Number(body.w))) : null;
  const h = Number.isFinite(Number(body.h)) ? Math.max(200, Math.round(Number(body.h))) : null;
  const position = Number.isFinite(Number(body.position)) ? Math.round(Number(body.position)) : null;
  const rows = await sql`
    UPDATE note_clusters SET
      name = CASE WHEN ${name !== null} THEN ${name || 'Untitled cluster'} ELSE name END,
      color = CASE WHEN ${color !== null} THEN ${color || '#2e6bf2'} ELSE color END,
      x = CASE WHEN ${x !== null} THEN ${x || 0} ELSE x END,
      y = CASE WHEN ${y !== null} THEN ${y || 0} ELSE y END,
      w = CASE WHEN ${w !== null} THEN ${w || 260} ELSE w END,
      h = CASE WHEN ${h !== null} THEN ${h || 200} ELSE h END,
      position = CASE WHEN ${position !== null} THEN ${position || 0} ELSE position END
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
    RETURNING id, name, color, x, y, w, h, position
  `;
  return rows[0] || null;
}

export async function softDeleteCluster(sql: Sql, ownerId: string, id: string) {
  if (!ID.test(id)) return false;
  await ensureNoteCanvas(sql);
  await sql`
    UPDATE note_clusters SET deleted_at = now()
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
  `;
  await sql`
    UPDATE notes SET cluster_id = NULL, updated_at = now()
    WHERE owner_id = ${ownerId} AND cluster_id = ${id}::uuid AND deleted_at IS NULL
  `;
  return true;
}
