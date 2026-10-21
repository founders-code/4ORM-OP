import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

export type ChangeKind = 'mail' | 'linkedin' | 'calendar' | 'pipeline' | 'zoom' | 'people';

const KINDS = new Set<ChangeKind>(['mail', 'linkedin', 'calendar', 'pipeline', 'zoom', 'people']);

export async function recordChange(sql: Sql, ownerId: string, kind: ChangeKind, payload: Record<string, unknown> = {}) {
  if (!KINDS.has(kind)) return;
  try {
    await sql`
      INSERT INTO change_log (owner_id, kind, payload)
      VALUES (${ownerId}, ${kind}, ${JSON.stringify(payload)}::jsonb)
    `;
  } catch (err) {
    fail('change_log', err);
  }
}

export async function latestCursor(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`SELECT COALESCE(MAX(id), 0) AS cursor FROM change_log WHERE owner_id = ${ownerId}`;
    return String(rows[0]?.cursor || '0');
  } catch (err) {
    fail('change_cursor', err);
    return '0';
  }
}

export async function kindsSince(sql: Sql, ownerId: string, since: string) {
  const cursor = Number(since);
  const start = Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
  try {
    const rows = await sql`
      SELECT DISTINCT kind FROM change_log
      WHERE owner_id = ${ownerId} AND id > ${start}
      ORDER BY kind
      LIMIT 12
    `;
    return (rows as Array<{ kind?: string }>).map((row) => String(row.kind || '')).filter((kind) => KINDS.has(kind as ChangeKind)) as ChangeKind[];
  } catch (err) {
    fail('change_kinds', err);
    return [] as ChangeKind[];
  }
}

export async function readMailCache(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`SELECT messages, linkedin, fetched_at FROM inbox_cache WHERE owner_id = ${ownerId} LIMIT 1`;
    if (!rows[0]) return null;
    return {
      messages: asJsonArray(rows[0].messages),
      linkedin: asJsonArray(rows[0].linkedin),
      fetchedAt: rows[0].fetched_at ? new Date(String(rows[0].fetched_at)).getTime() : 0,
    };
  } catch (err) {
    fail('mail_cache_read', err);
    return null;
  }
}

export async function writeMailCache(
  sql: Sql,
  ownerId: string,
  messages: unknown[],
  linkedin: unknown[],
) {
  try {
    await sql`
      INSERT INTO inbox_cache (owner_id, messages, linkedin, fetched_at)
      VALUES (${ownerId}, ${JSON.stringify(messages)}::jsonb, ${JSON.stringify(linkedin)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET
        messages = EXCLUDED.messages,
        linkedin = EXCLUDED.linkedin,
        fetched_at = now()
    `;
  } catch (err) {
    fail('mail_cache_write', err);
  }
}

export async function readPipelineCache(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`SELECT pipelines, stages, fetched_at FROM pipeline_cache WHERE owner_id = ${ownerId} LIMIT 1`;
    if (!rows[0]) return null;
    return {
      pipelines: asJsonArray(rows[0].pipelines),
      stages: asJsonArray(rows[0].stages),
      fetchedAt: rows[0].fetched_at ? new Date(String(rows[0].fetched_at)).getTime() : 0,
    };
  } catch (err) {
    fail('pipe_cache_read', err);
    return null;
  }
}

export async function writePipelineCache(sql: Sql, ownerId: string, pipelines: unknown[], stages: unknown[]) {
  try {
    await sql`
      INSERT INTO pipeline_cache (owner_id, pipelines, stages, fetched_at)
      VALUES (${ownerId}, ${JSON.stringify(pipelines)}::jsonb, ${JSON.stringify(stages)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET
        pipelines = EXCLUDED.pipelines,
        stages = EXCLUDED.stages,
        fetched_at = now()
    `;
  } catch (err) {
    fail('pipe_cache_write', err);
  }
}

export function asJsonArray(value: unknown): unknown[] {
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
