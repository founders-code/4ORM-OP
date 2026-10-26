import type { getSql } from './db';

type Sql = NonNullable<Awaited<ReturnType<typeof getSql>>>;

export type DriveMark = {
  id: string;
  kind: 'star' | 'pin';
  name: string;
  url: string;
  mime: string;
  thumb: string;
  modified: string;
  position: number;
};

const DRIVE_ID = /^[\w-]{8,}$/;

export function driveIdOk(id: unknown) {
  return DRIVE_ID.test(String(id || ''));
}

function clip(value: unknown, max: number) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** Additive and idempotent. Stars (folders) and pins ("Pinned for the raise") for Drive. Unstar/unpin is a soft delete. */
export async function ensureDriveMarks(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS drive_marks (
    owner_id text NOT NULL,
    drive_id text NOT NULL,
    kind text NOT NULL,
    name text NOT NULL DEFAULT '',
    url text NOT NULL DEFAULT '',
    mime text NOT NULL DEFAULT '',
    thumb text NOT NULL DEFAULT '',
    modified text NOT NULL DEFAULT '',
    position int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    PRIMARY KEY (owner_id, drive_id, kind)
  )`;
}

export async function listDriveMarks(sql: Sql, ownerId: string) {
  await ensureDriveMarks(sql);
  const rows = (await sql`
    SELECT drive_id, kind, name, url, mime, thumb, modified, position
    FROM drive_marks
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    ORDER BY kind, position, updated_at DESC
  `) as Array<Record<string, unknown>>;
  const marks: DriveMark[] = rows.map((row) => ({
    id: String(row.drive_id),
    kind: String(row.kind) === 'pin' ? 'pin' : 'star',
    name: String(row.name || ''),
    url: String(row.url || ''),
    mime: String(row.mime || ''),
    thumb: String(row.thumb || ''),
    modified: String(row.modified || ''),
    position: Number(row.position) || 0,
  }));
  return {
    stars: marks.filter((m) => m.kind === 'star').map((m) => m.id),
    pins: marks.filter((m) => m.kind === 'pin'),
  };
}

export async function setDriveMark(
  sql: Sql,
  ownerId: string,
  input: { id: string; kind: 'star' | 'pin'; on: boolean; name?: unknown; url?: unknown; mime?: unknown; thumb?: unknown; modified?: unknown },
) {
  await ensureDriveMarks(sql);
  if (!input.on) {
    await sql`
      UPDATE drive_marks SET deleted_at = now(), updated_at = now()
      WHERE owner_id = ${ownerId} AND drive_id = ${input.id} AND kind = ${input.kind} AND deleted_at IS NULL
    `;
    return;
  }
  const top = (await sql`
    SELECT COALESCE(MIN(position), 0) - 1 AS p FROM drive_marks
    WHERE owner_id = ${ownerId} AND kind = ${input.kind} AND deleted_at IS NULL
  `) as Array<{ p: number }>;
  const url = clip(input.url, 600);
  await sql`
    INSERT INTO drive_marks (owner_id, drive_id, kind, name, url, mime, thumb, modified, position, updated_at, deleted_at)
    VALUES (${ownerId}, ${input.id}, ${input.kind}, ${clip(input.name, 300)}, ${/^https:\/\//.test(url) ? url : ''},
            ${clip(input.mime, 120)}, ${clip(input.thumb, 600)}, ${clip(input.modified, 40)}, ${Number(top[0]?.p) || 0}, now(), NULL)
    ON CONFLICT (owner_id, drive_id, kind) DO UPDATE SET
      name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE drive_marks.name END,
      url = CASE WHEN EXCLUDED.url <> '' THEN EXCLUDED.url ELSE drive_marks.url END,
      mime = CASE WHEN EXCLUDED.mime <> '' THEN EXCLUDED.mime ELSE drive_marks.mime END,
      thumb = CASE WHEN EXCLUDED.thumb <> '' THEN EXCLUDED.thumb ELSE drive_marks.thumb END,
      modified = CASE WHEN EXCLUDED.modified <> '' THEN EXCLUDED.modified ELSE drive_marks.modified END,
      position = CASE WHEN drive_marks.deleted_at IS NULL THEN drive_marks.position ELSE EXCLUDED.position END,
      deleted_at = NULL,
      updated_at = now()
  `;
}

export async function orderDrivePins(sql: Sql, ownerId: string, ids: string[]) {
  await ensureDriveMarks(sql);
  const clean = ids.filter(driveIdOk).slice(0, 60);
  for (let i = 0; i < clean.length; i += 1) {
    await sql`
      UPDATE drive_marks SET position = ${i}, updated_at = now()
      WHERE owner_id = ${ownerId} AND drive_id = ${clean[i]} AND kind = 'pin' AND deleted_at IS NULL
    `;
  }
  return clean.length;
}

/** Which live Space each Drive file is attached to (space_items.drive_file_id). Empty when the Spaces tables are missing. */
export async function driveSpaceLinks(sql: Sql, ownerId: string) {
  try {
    const rows = (await sql`
      SELECT DISTINCT ON (i.drive_file_id) i.drive_file_id, s.id, s.name
      FROM space_items i JOIN spaces s ON s.id = i.space_id
      WHERE i.owner_id = ${ownerId} AND s.owner_id = ${ownerId}
        AND i.deleted_at IS NULL AND s.deleted_at IS NULL
        AND COALESCE(i.drive_file_id, '') <> ''
      ORDER BY i.drive_file_id, i.created_at DESC
      LIMIT 2000
    `) as Array<Record<string, unknown>>;
    const out: Record<string, { spaceId: string; space: string }> = {};
    for (const row of rows) out[String(row.drive_file_id)] = { spaceId: String(row.id), space: String(row.name || 'Space') };
    return out;
  } catch {
    return {};
  }
}
