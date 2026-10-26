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

/**
 * W56: Signals counts (owed from meetings, reach out, going cold) and the Today/Week/Later items change
 * without a change_log row. The poll compares a short fingerprint per panel with the one the client sent
 * back, and ships only the panels that moved.
 */
export type PanelKey = 'items' | 'owed' | 'reach' | 'people';
export const PANEL_KEYS: PanelKey[] = ['items', 'owed', 'reach', 'people'];

export async function panelFingerprints(sql: Sql, ownerId: string) {
  const out: Record<PanelKey, string> = { items: '', owed: '', reach: '', people: '' };
  const one = async (key: PanelKey, run: () => Promise<Array<Record<string, unknown>>>) => {
    try {
      const rows = await run();
      out[key] = String(rows[0]?.fp || '').slice(0, 32);
    } catch (err) {
      fail(`change_fp_${key}`, err);
    }
  };
  await Promise.all([
    one('items', () => sql`
      SELECT md5(count(*)::text || '|' || coalesce(max(updated_at)::text, '') || '|' || coalesce(sum(coalesce((to_jsonb(items) ->> 'position')::int, 0)), 0)::text) AS fp
      FROM items WHERE owner_id = ${ownerId} AND status <> 'dropped'
    ` as Promise<Array<Record<string, unknown>>>),
    one('owed', () => sql`
      SELECT md5(coalesce(string_agg(id::text || status || coalesce(board_column, ''), ',' ORDER BY id), '')) AS fp
      FROM meeting_actions WHERE owner_id = ${ownerId} AND status = 'open' AND deleted_at IS NULL
    ` as Promise<Array<Record<string, unknown>>>),
    one('reach', () => sql`
      SELECT md5(coalesce(string_agg(id::text || done::text || coalesce(next_action, ''), ',' ORDER BY id), '')) AS fp
      FROM reach_out WHERE owner_id = ${ownerId}
    ` as Promise<Array<Record<string, unknown>>>),
    one('people', () => sql`
      SELECT md5(count(*)::text || '|' || coalesce(max(last_touch)::text, '')) AS fp
      FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    ` as Promise<Array<Record<string, unknown>>>),
  ]);
  return out;
}

/** "items.owed.reach.people" fingerprints, as the client echoes them back in ?fp=. */
export function parseFingerprints(raw: string): Partial<Record<PanelKey, string>> {
  const parts = String(raw || '').slice(0, 200).split('.');
  const out: Partial<Record<PanelKey, string>> = {};
  PANEL_KEYS.forEach((key, i) => {
    if (/^[0-9a-f]{32}$/.test(parts[i] || '')) out[key] = parts[i];
  });
  return out;
}

/** Board-shaped items (same read as lib/board.ts) so the client can replace STATE.items in place. */
export async function readBoardItems(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT id, title, area, status, priority, due, owner, source, category, to_jsonb(items) ->> 'position' AS position
    FROM items
    WHERE owner_id = ${ownerId}
      AND status <> 'dropped'
      AND (snooze_until IS NULL OR snooze_until <= now())
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    area: String(row.area),
    status: String(row.status),
    priority: String(row.priority),
    due: row.due ? new Date(String(row.due)).getTime() : null,
    owner: String(row.owner || ''),
    source: String(row.source || 'manual'),
    category: row.category ? String(row.category) : '',
    waitingOn: '',
    planOf: '',
    position: row.position == null || row.position === '' ? null : Number(row.position),
  }));
}
