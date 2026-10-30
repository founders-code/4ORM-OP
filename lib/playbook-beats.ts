import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { pacificDay } from './snapshots';

type Sql = NeonQueryFunction<false, false>;

/**
 * P13 longer beats: a rhythm with a cadence (every N days, weekly, monthly, quarterly) and an anchor date.
 * Stored on playbook_rhythms (additive cadence jsonb column); rows with a cadence are left out of the daily grid.
 * Remove = active false (soft). Done = a playbook_log row on that beat's due day, which moves the countdown on.
 */
export type CadenceKind = 'days' | 'weekly' | 'monthly' | 'quarterly';
export type Cadence = { kind: CadenceKind; every: number; anchor: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const SEED_BEATS: Array<{ name: string; color: string; sub: string; cadence: Cadence }> = [
  { name: 'Marketing drop', color: '--green', sub: 'material ready', cadence: { kind: 'days', every: 14, anchor: '2026-10-20' } },
  { name: 'Newsletter', color: '--blue', sub: 'draft', cadence: { kind: 'monthly', every: 1, anchor: '2026-10-31' } },
  { name: 'Research paper', color: '--violet', sub: 'outline', cadence: { kind: 'monthly', every: 1, anchor: '2026-11-15' } },
  { name: 'Investor update', color: '--red', sub: 'metrics', cadence: { kind: 'monthly', every: 1, anchor: '2026-11-05' } },
  { name: 'Investor letter', color: '--amber', sub: '', cadence: { kind: 'quarterly', every: 1, anchor: '2027-01-15' } },
];

export async function ensureBeats(sql: Sql) {
  try {
    await sql`ALTER TABLE playbook_rhythms ADD COLUMN IF NOT EXISTS cadence jsonb`;
    /* 30 Oct 2026: the plan for each due date (steps ticked, a note per step), keyed by due day. Additive. */
    await sql`ALTER TABLE playbook_rhythms ADD COLUMN IF NOT EXISTS plan jsonb NOT NULL DEFAULT '{}'::jsonb`;
  } catch (err) {
    fail('playbook_beats_column', err);
  }
}

/** Validated cadence or null. every: 1-365 for days; ignored (1) otherwise. */
export function readCadence(value: unknown): Cadence | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const kind = String(v.kind || '') as CadenceKind;
  if (!['days', 'weekly', 'monthly', 'quarterly'].includes(kind)) return null;
  const anchor = String(v.anchor || '');
  if (!DAY.test(anchor) || !Number.isFinite(Date.parse(`${anchor}T12:00:00Z`))) return null;
  const every = kind === 'days' ? Math.round(Number(v.every)) : 1;
  if (kind === 'days' && !(every >= 1 && every <= 365)) return null;
  return { kind, every, anchor };
}

function utc(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function ymd(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
function addDays(day: string, n: number) {
  return ymd(utc(day) + n * 86400000);
}
/** Same day-of-month as the anchor, k months later, clamped to the month's last day. */
function addMonths(anchor: string, k: number) {
  const [y, m, d] = anchor.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + k + 1, 0)).getUTCDate();
  return ymd(Date.UTC(y, m - 1 + k, Math.min(d, last)));
}

/** The k-th occurrence (k may be negative). */
function occurrence(c: Cadence, k: number) {
  if (c.kind === 'days') return addDays(c.anchor, k * c.every);
  if (c.kind === 'weekly') return addDays(c.anchor, k * 7);
  return addMonths(c.anchor, k * (c.kind === 'quarterly' ? 3 : 1));
}

/** First occurrence on or after `day`, skipping occurrences already logged done. */
export function nextDue(c: Cadence, day: string, done: Set<string> = new Set()) {
  let k = 0;
  if (c.kind === 'days' || c.kind === 'weekly') {
    const step = c.kind === 'days' ? c.every : 7;
    k = Math.ceil((utc(day) - utc(c.anchor)) / 86400000 / step);
  } else {
    const [ay, am] = c.anchor.split('-').map(Number);
    const [ty, tm] = day.split('-').map(Number);
    k = Math.floor(((ty - ay) * 12 + (tm - am)) / (c.kind === 'quarterly' ? 3 : 1)) - 1;
  }
  let due = occurrence(c, k);
  let guard = 0;
  while ((due < day || done.has(due)) && guard < 400) {
    k += 1;
    due = occurrence(c, k);
    guard += 1;
  }
  return { due, prev: occurrence(c, k - 1) };
}

export function cadenceLabel(c: Cadence) {
  if (c.kind === 'days') return c.every === 1 ? 'daily' : c.every === 7 ? 'weekly' : `every ${c.every} days`;
  return c.kind;
}

function readJson(v: unknown): unknown {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

export async function seedBeats(sql: Sql, ownerId: string) {
  const any = await sql`SELECT 1 FROM playbook_rhythms WHERE owner_id = ${ownerId} AND cadence IS NOT NULL LIMIT 1`;
  if (any.length) return;
  for (const [i, b] of SEED_BEATS.entries()) {
    await sql`
      INSERT INTO playbook_rhythms (owner_id, name, color, route, schedule, target, sort, active, sub, grp, cadence)
      VALUES (${ownerId}, ${b.name}, ${b.color}, 'war', '[]'::jsonb, '', ${900 + i}, true, ${b.sub}, 'Beat', ${JSON.stringify(b.cadence)}::jsonb)
      ON CONFLICT (owner_id, name) DO NOTHING
    `;
  }
}

export async function listBeats(sql: Sql, ownerId: string) {
  await ensureBeats(sql);
  await seedBeats(sql, ownerId).catch((err) => fail('playbook_beats_seed', err));
  const today = pacificDay();
  const rows = (await sql`
    SELECT id::text AS id, name, color, sub, sort, cadence, plan
    FROM playbook_rhythms
    WHERE owner_id = ${ownerId} AND active = true AND cadence IS NOT NULL
    ORDER BY sort, name
  `) as Array<Record<string, unknown>>;
  if (!rows.length) return [];
  const logs = (await sql`
    SELECT rhythm_id::text AS rhythm_id, day::text AS day
    FROM playbook_log
    WHERE owner_id = ${ownerId} AND status = 'done' AND day >= (${today}::date - 400)
      AND rhythm_id = ANY(${rows.map((r) => String(r.id))}::uuid[])
  `) as Array<{ rhythm_id: string; day: string }>;
  const doneBy = new Map<string, Set<string>>();
  for (const l of logs) {
    const set = doneBy.get(l.rhythm_id) || new Set<string>();
    set.add(String(l.day).slice(0, 10));
    doneBy.set(l.rhythm_id, set);
  }
  const out = [];
  for (const r of rows) {
    const cadence = readCadence(readJson(r.cadence));
    if (!cadence) continue;
    const done = doneBy.get(String(r.id)) || new Set<string>();
    const { due, prev } = nextDue(cadence, today, done);
    const span = Math.max(1, (utc(due) - utc(prev)) / 86400000);
    const left = Math.round((utc(due) - utc(today)) / 86400000);
    const lastDone = [...done].sort().pop() || '';
    out.push({
      id: String(r.id),
      name: String(r.name || ''),
      color: String(r.color || '--blue'),
      sub: String(r.sub || ''),
      cadence,
      label: cadenceLabel(cadence),
      nextDue: due,
      prevDue: prev,
      daysLeft: left,
      pct: Math.max(3, Math.min(100, Math.round(((span - left) / span) * 100))),
      lastDone,
      plan: planFor(readJson(r.plan), due),
    });
  }
  return out;
}

export async function addBeat(sql: Sql, ownerId: string, input: { name: string; cadence: Cadence; color?: string; sub?: string }) {
  await ensureBeats(sql);
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) return null;
  const rows = await sql`
    INSERT INTO playbook_rhythms (owner_id, name, color, route, schedule, target, sort, active, sub, grp, cadence)
    VALUES (${ownerId}, ${name}, ${String(input.color || '--blue').slice(0, 20)}, 'war', '[]'::jsonb, '', 950, true,
      ${String(input.sub || '').slice(0, 80)}, 'Beat', ${JSON.stringify(input.cadence)}::jsonb)
    ON CONFLICT (owner_id, name) DO UPDATE SET active = true, cadence = EXCLUDED.cadence, grp = 'Beat'
      WHERE playbook_rhythms.cadence IS NOT NULL OR playbook_rhythms.active = false
    RETURNING id::text AS id
  `;
  return rows[0] ? String(rows[0].id) : null;
}

export async function patchBeat(sql: Sql, ownerId: string, id: string, input: { name?: string; cadence?: Cadence; sub?: string; color?: string; active?: boolean }) {
  await ensureBeats(sql);
  const rows = await sql`
    UPDATE playbook_rhythms SET
      name = COALESCE(${input.name ? input.name.trim().slice(0, 80) : null}, name),
      cadence = COALESCE(${input.cadence ? JSON.stringify(input.cadence) : null}::jsonb, cadence),
      sub = COALESCE(${input.sub != null ? String(input.sub).slice(0, 80) : null}, sub),
      color = COALESCE(${input.color ? String(input.color).slice(0, 20) : null}, color),
      active = COALESCE(${input.active == null ? null : !!input.active}::boolean, active)
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND cadence IS NOT NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/** Mark the beat's current due date done (or undo with undo=true). */
export async function markBeat(sql: Sql, ownerId: string, id: string, day: string, undo = false) {
  if (!DAY.test(day)) return false;
  const own = await sql`SELECT 1 FROM playbook_rhythms WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND cadence IS NOT NULL`;
  if (!own.length) return false;
  if (undo) {
    // Undo turns the log row back to 'open' (kept, never deleted).
    await sql`UPDATE playbook_log SET status = 'open' WHERE owner_id = ${ownerId} AND rhythm_id = ${id}::uuid AND day = ${day}::date`;
    return true;
  }
  await sql`
    INSERT INTO playbook_log (owner_id, rhythm_id, day, status, value)
    VALUES (${ownerId}, ${id}::uuid, ${day}::date, 'done', '')
    ON CONFLICT (owner_id, rhythm_id, day) DO UPDATE SET status = 'done'
  `;
  return true;
}

/** The saved steps for one due date: { stepKey: { done, note } }. */
function planFor(value: unknown, due: string) {
  const all = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const day = all[due];
  const out: Record<string, { done: boolean; note: string }> = {};
  if (day && typeof day === 'object') {
    for (const [k, v] of Object.entries(day as Record<string, unknown>).slice(0, 30)) {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      out[k.slice(0, 40)] = { done: !!o.done, note: String(o.note || '').slice(0, 1000) };
    }
  }
  return out;
}

const STEP = /^[a-z0-9-]{1,40}$/;

/** Tick a plan step or save its note for one due date. Nothing else on the beat changes. */
export async function setPlanStep(sql: Sql, ownerId: string, id: string, day: string, step: string, input: { done?: boolean; note?: string }) {
  if (!DAY.test(day) || !STEP.test(step)) return false;
  await ensureBeats(sql);
  const rows = (await sql`SELECT plan FROM playbook_rhythms WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND cadence IS NOT NULL LIMIT 1`) as Array<{ plan: unknown }>;
  if (!rows.length) return false;
  const plan = (readJson(rows[0].plan) || {}) as Record<string, Record<string, { done?: boolean; note?: string }>>;
  const keepFrom = addDays(day, -400);
  for (const k of Object.keys(plan)) if (!DAY.test(k) || k < keepFrom) delete plan[k];
  const cur = plan[day] || {};
  const was = cur[step] || {};
  cur[step] = {
    done: typeof input.done === 'boolean' ? input.done : !!was.done,
    note: input.note != null ? String(input.note).slice(0, 1000) : String(was.note || ''),
  };
  plan[day] = cur;
  await sql`UPDATE playbook_rhythms SET plan = ${JSON.stringify(plan)}::jsonb WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  return true;
}
