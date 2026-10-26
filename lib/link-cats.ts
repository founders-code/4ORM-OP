import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

export const UNCAT = 'Uncategorized';
const ID = /^[0-9a-f-]{36}$/i;

export function cleanCat(value: unknown) {
  return String(value || '').trim().slice(0, 80);
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanCat(item)).filter(Boolean) : [];
}

export function asNestMap(value: unknown): Record<string, string[]> {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, kids]) => {
    const name = cleanCat(key);
    if (name) out[name] = asList(kids).slice(0, 40);
  });
  return out;
}

function addAll(list: string[], more: string[]) {
  more.forEach((item) => {
    if (!list.includes(item)) list.push(item);
  });
  return list;
}

/** A live (not soft-deleted) category row. Works before the deleted_at column exists. */
async function liveRow(sql: Sql, ownerId: string, name: string) {
  const rows = await sql`
    SELECT name, subs, nest FROM link_categories
    WHERE owner_id = ${ownerId} AND name = ${name}
      AND COALESCE(to_jsonb(link_categories) ->> 'deleted_at', '') = ''
    LIMIT 1
  `;
  return (rows[0] as Record<string, unknown> | undefined) || null;
}

async function ensureUncategorized(sql: Sql, ownerId: string) {
  await sql`
    INSERT INTO link_categories (owner_id, name, subs)
    VALUES (${ownerId}, ${UNCAT}, '{}')
    ON CONFLICT (owner_id, name) DO NOTHING
  `;
}

/**
 * Soft delete a top-level category. Its links move to Uncategorized (keeping sub and leaf), its subfolders are
 * merged into Uncategorized, and the row keeps an undo snapshot so restoreCategory can put everything back.
 */
export async function softDeleteCategory(sql: Sql, ownerId: string, name: string) {
  const clean = cleanCat(name);
  if (!clean || clean === UNCAT) return { ok: false as const, status: 400, error: 'That category cannot be removed.' };
  const row = await liveRow(sql, ownerId, clean);
  if (!row) return { ok: false as const, status: 404, error: 'That category is already gone.' };
  await ensureUncategorized(sql, ownerId);
  const moved = await sql`
    SELECT id FROM links
    WHERE owner_id = ${ownerId} AND category = ${clean} AND deleted_at IS NULL
  `;
  const ids = (moved as Record<string, unknown>[]).map((r) => String(r.id)).filter((id) => ID.test(id));
  const home = await sql`SELECT subs, nest FROM link_categories WHERE owner_id = ${ownerId} AND name = ${UNCAT} LIMIT 1`;
  const homeSubs = asList(home[0]?.subs);
  const homeNest = asNestMap(home[0]?.nest);
  const ownSubs = asList(row.subs);
  const ownNest = asNestMap(row.nest);
  const addedSubs = ownSubs.filter((sub) => !homeSubs.includes(sub));
  const addedNest = Object.keys(ownNest).filter((key) => !homeNest[key]);
  const subs = addAll(homeSubs.slice(), ownSubs);
  Object.entries(ownNest).forEach(([kid, leaves]) => {
    homeNest[kid] = addAll(homeNest[kid] || [], leaves).slice(0, 40);
  });
  await sql`
    UPDATE link_categories SET subs = ${subs}::text[], nest = ${JSON.stringify(homeNest)}::jsonb
    WHERE owner_id = ${ownerId} AND name = ${UNCAT}
  `;
  if (ids.length) {
    await sql`UPDATE links SET category = ${UNCAT} WHERE owner_id = ${ownerId} AND id = ANY(${ids}::uuid[])`;
  }
  const undo = { ids, addedSubs, addedNest };
  await sql`
    UPDATE link_categories SET deleted_at = now(), undo = ${JSON.stringify(undo)}::jsonb
    WHERE owner_id = ${ownerId} AND name = ${clean} AND name <> ${UNCAT}
  `;
  return { ok: true as const, name: clean, moved: ids.length };
}

/** Undo a soft delete: revive the row and move its links back from Uncategorized. */
export async function restoreCategory(sql: Sql, ownerId: string, name: string) {
  const clean = cleanCat(name);
  if (!clean || clean === UNCAT) return { ok: false as const, status: 400, error: 'Nothing to restore.' };
  const rows = await sql`
    SELECT undo FROM link_categories
    WHERE owner_id = ${ownerId} AND name = ${clean} AND deleted_at IS NOT NULL
    LIMIT 1
  `;
  if (!rows.length) return { ok: false as const, status: 404, error: 'Nothing to restore.' };
  let undo = rows[0]?.undo as unknown;
  if (typeof undo === 'string') {
    try { undo = JSON.parse(undo); } catch { undo = {}; }
  }
  const snap = (undo && typeof undo === 'object' ? undo : {}) as { ids?: unknown; addedSubs?: unknown; addedNest?: unknown };
  const ids = (Array.isArray(snap.ids) ? snap.ids : []).map((id) => String(id)).filter((id) => ID.test(id));
  const addedSubs = asList(snap.addedSubs);
  const addedNest = asList(snap.addedNest);
  await sql`
    UPDATE link_categories SET deleted_at = NULL, undo = NULL
    WHERE owner_id = ${ownerId} AND name = ${clean}
  `;
  if (ids.length) {
    await sql`
      UPDATE links SET category = ${clean}
      WHERE owner_id = ${ownerId} AND category = ${UNCAT} AND id = ANY(${ids}::uuid[])
    `;
  }
  if (addedSubs.length || addedNest.length) {
    const home = await sql`SELECT subs, nest FROM link_categories WHERE owner_id = ${ownerId} AND name = ${UNCAT} LIMIT 1`;
    const still = await sql`
      SELECT DISTINCT sub FROM links
      WHERE owner_id = ${ownerId} AND category = ${UNCAT} AND deleted_at IS NULL AND COALESCE(sub, '') <> ''
    `;
    const used = (still as Record<string, unknown>[]).map((r) => String(r.sub));
    const subs = asList(home[0]?.subs).filter((sub) => !addedSubs.includes(sub) || used.includes(sub));
    const nest = asNestMap(home[0]?.nest);
    addedNest.forEach((key) => {
      if (!used.includes(key)) delete nest[key];
    });
    await sql`
      UPDATE link_categories SET subs = ${subs}::text[], nest = ${JSON.stringify(nest)}::jsonb
      WHERE owner_id = ${ownerId} AND name = ${UNCAT}
    `;
  }
  return { ok: true as const, name: clean, restored: ids.length };
}

/**
 * Nest a folder into another top-level folder and move its links with it.
 * Top-level X into Y: links X/s/l become Y/X/s (depth stays at three, so X's own third level folds into its subs),
 * Y gains X as a subfolder with X's subfolders as leaves, and X's row is soft deleted.
 * Subfolder X of P into Y: links P/X/l become Y/X/l, and the nest entry moves from P to Y.
 */
export async function nestCategory(sql: Sql, ownerId: string, moving: string, into: string, parent: string) {
  const x = cleanCat(moving);
  const y = cleanCat(into);
  const p = cleanCat(parent);
  if (!x || !y || x === y || x === UNCAT) return { ok: false as const, status: 400, error: 'Cannot nest that folder there.' };
  const target = await liveRow(sql, ownerId, y);
  if (!target) return { ok: false as const, status: 404, error: 'That folder is gone.' };
  const ySubs = asList(target.subs);
  const yNest = asNestMap(target.nest);
  if (!p) {
    const src = await liveRow(sql, ownerId, x);
    if (!src) return { ok: false as const, status: 404, error: 'That folder is gone.' };
    const xSubs = asList(src.subs);
    const xNest = asNestMap(src.nest);
    const leaves = addAll(xSubs.slice(), Object.keys(xNest)).slice(0, 40);
    await sql`
      UPDATE links SET category = ${y}, leaf = COALESCE(sub, ''), sub = ${x}
      WHERE owner_id = ${ownerId} AND category = ${x}
    `;
    addAll(ySubs, [x]);
    yNest[x] = addAll(yNest[x] || [], leaves).slice(0, 40);
    await sql`
      UPDATE link_categories SET subs = ${ySubs}::text[], nest = ${JSON.stringify(yNest)}::jsonb
      WHERE owner_id = ${ownerId} AND name = ${y}
    `;
    await sql`
      UPDATE link_categories SET deleted_at = now(), undo = NULL
      WHERE owner_id = ${ownerId} AND name = ${x} AND name <> ${UNCAT}
    `;
    return { ok: true as const, moving: x, into: y };
  }
  if (p === y) return { ok: true as const, moving: x, into: y };
  const from = await liveRow(sql, ownerId, p);
  const pNest = asNestMap(from?.nest);
  if (from && !asList(from.subs).includes(x) && !pNest[x]) {
    return { ok: false as const, status: 400, error: 'Only folders and subfolders can be nested.' };
  }
  const pSubs = asList(from?.subs).filter((sub) => sub !== x);
  await sql`
    UPDATE links SET category = ${y}
    WHERE owner_id = ${ownerId} AND category = ${p} AND sub = ${x}
  `;
  addAll(ySubs, [x]);
  yNest[x] = addAll(yNest[x] || [], pNest[x] || []).slice(0, 40);
  delete pNest[x];
  await sql`
    UPDATE link_categories SET subs = ${ySubs}::text[], nest = ${JSON.stringify(yNest)}::jsonb
    WHERE owner_id = ${ownerId} AND name = ${y}
  `;
  if (from) {
    await sql`
      UPDATE link_categories SET subs = ${pSubs}::text[], nest = ${JSON.stringify(pNest)}::jsonb
      WHERE owner_id = ${ownerId} AND name = ${p}
    `;
  }
  return { ok: true as const, moving: x, into: y };
}
