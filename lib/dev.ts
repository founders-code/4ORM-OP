import type { Sql } from './db';

/**
 * Development (31 Oct 2026): projects run through the CTO brain's stages.
 * A project holds gates and deliverables. Each deliverable has a stage (frame to ship), a pass-or-fail done-check,
 * the evidence file that proves it, and the gate it feeds. Every change is written to dev_log, which is never
 * edited, so an approval or a check result is on record with who and when.
 * Plans arrive as the JSON the planning chat writes (plan, close, target_submit, gates, deliverables) and are
 * imported by code: re-importing updates the plan text and keeps every stage, check and note already set.
 */
export const STAGES = ['not started', 'frame', 'design', 'slice', 'build', 'verify', 'ship', 'done'] as const;
const CHECKS = ['pending', 'pass', 'fail'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

let ready: Promise<void> | null = null;
export function ensureDev(sql: Sql) {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS dev_projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text NOT NULL,
        name text NOT NULL,
        goal text NOT NULL DEFAULT '',
        lane text NOT NULL DEFAULT '',
        close_at timestamptz,
        target date,
        sort int NOT NULL DEFAULT 0,
        archived boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (owner_id, name)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS dev_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text NOT NULL,
        project_id uuid NOT NULL,
        code text NOT NULL,
        kind text NOT NULL DEFAULT 'deliverable',
        layer text NOT NULL DEFAULT '',
        title text NOT NULL,
        owner_name text NOT NULL DEFAULT '',
        start_date date,
        due_date date,
        depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,
        gate text NOT NULL DEFAULT '',
        done_check text NOT NULL DEFAULT '',
        evidence text NOT NULL DEFAULT '',
        critical boolean NOT NULL DEFAULT false,
        note text NOT NULL DEFAULT '',
        plan_note text NOT NULL DEFAULT '',
        stage text NOT NULL DEFAULT 'not started',
        check_state text NOT NULL DEFAULT 'pending',
        sort int NOT NULL DEFAULT 0,
        archived boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (project_id, code)
      )`;
      /* 31 Oct: plain-language brief per item. why = why it matters; steps = [{t, how}] from the plan; step_done = ticks by index. */
      await sql`ALTER TABLE dev_items ADD COLUMN IF NOT EXISTS why text NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE dev_items ADD COLUMN IF NOT EXISTS steps jsonb NOT NULL DEFAULT '[]'::jsonb`;
      await sql`ALTER TABLE dev_items ADD COLUMN IF NOT EXISTS step_done jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql`CREATE TABLE IF NOT EXISTS dev_log (
        id bigserial PRIMARY KEY,
        owner_id text NOT NULL,
        project_id uuid,
        item_id uuid,
        code text NOT NULL DEFAULT '',
        action text NOT NULL,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        at timestamptz NOT NULL DEFAULT now()
      )`;
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

const s = (v: unknown, n: number) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const day = (v: unknown) => (DAY.test(String(v || '')) ? String(v) : null);

async function log(sql: Sql, ownerId: string, projectId: string | null, itemId: string | null, code: string, action: string, detail: Record<string, unknown>) {
  await sql`INSERT INTO dev_log (owner_id, project_id, item_id, code, action, detail)
    VALUES (${ownerId}, ${projectId}, ${itemId}, ${code}, ${action}, ${JSON.stringify(detail)}::jsonb)`;
}

/** Everything the page draws: projects, their gates and deliverables, and the last 40 log lines. */
export async function readDev(sql: Sql, ownerId: string) {
  await ensureDev(sql);
  const projects = await sql`SELECT id::text, name, goal, lane, close_at, target::text AS target, sort FROM dev_projects
    WHERE owner_id = ${ownerId} AND NOT archived ORDER BY sort, created_at`;
  const items = await sql`SELECT id::text, project_id::text, code, kind, layer, title, owner_name, start_date::text AS start_date,
      due_date::text AS due_date, depends_on, gate, done_check, evidence, critical, note, plan_note, why, steps, step_done, stage, check_state, sort, updated_at
    FROM dev_items WHERE owner_id = ${ownerId} AND NOT archived ORDER BY sort, code`;
  const logRows = await sql`SELECT l.id, l.project_id::text, l.code, l.action, l.detail, l.at FROM dev_log l
    WHERE l.owner_id = ${ownerId} AND l.action <> 'sync' ORDER BY l.at DESC LIMIT 40`;
  return { projects, items, log: logRows, stages: STAGES };
}

type PlanGate = { id?: string; name?: string; date?: string; test?: string; fail_action?: string; why?: string; steps?: unknown };
type PlanItem = { id?: string; layer?: string; title?: string; owner?: string; start?: string; due?: string; depends_on?: unknown; gate?: string | null;
  done_check?: string; evidence?: string; critical_path?: boolean; note?: string; why?: string; steps?: unknown };

/** Steps as the page stores them: [{ t: what to do, how: plain directions }], at most 30, each bounded. */
function readSteps(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).map((x) => {
    const o = (x && typeof x === 'object' ? x : { t: x }) as Record<string, unknown>;
    return { t: s(o.t || o.title || o.step, 200), how: String(o.how || o.detail || '').trim().slice(0, 1500) };
  }).filter((x) => x.t);
}

/** Import or refresh a plan. Plan text is replaced; stage, check and Chad's notes are kept. Nothing is removed. */
export async function importPlan(sql: Sql, ownerId: string, plan: Record<string, unknown>) {
  await ensureDev(sql);
  const name = s(plan.plan || plan.name, 160);
  if (!name) throw new Error('The plan has no name.');
  const gates = (Array.isArray(plan.gates) ? plan.gates : []).slice(0, 40) as PlanGate[];
  const items = (Array.isArray(plan.deliverables) ? plan.deliverables : []).slice(0, 300) as PlanItem[];
  if (!gates.length && !items.length) throw new Error('The plan has no gates or deliverables.');
  const close = Number.isFinite(Date.parse(String(plan.close || ''))) ? new Date(String(plan.close)).toISOString() : null;
  const goal = s(plan.goal || '', 400);
  const rows = await sql`INSERT INTO dev_projects (owner_id, name, goal, lane, close_at, target)
    VALUES (${ownerId}, ${name}, ${goal}, ${s(plan.lane || 'Prototype', 40)}, ${close}, ${day(plan.target_submit)})
    ON CONFLICT (owner_id, name) DO UPDATE SET close_at = COALESCE(EXCLUDED.close_at, dev_projects.close_at),
      target = COALESCE(EXCLUDED.target, dev_projects.target), goal = CASE WHEN EXCLUDED.goal <> '' THEN EXCLUDED.goal ELSE dev_projects.goal END,
      archived = false
    RETURNING id::text`;
  const projectId = String(rows[0].id);
  let n = 0;
  const put = async (code: string, row: Record<string, unknown>) => {
    await sql`INSERT INTO dev_items (owner_id, project_id, code, kind, layer, title, owner_name, start_date, due_date, depends_on, gate,
        done_check, evidence, critical, plan_note, why, steps, sort)
      VALUES (${ownerId}, ${projectId}::uuid, ${code}, ${row.kind as string}, ${row.layer as string}, ${row.title as string}, ${row.owner as string},
        ${row.start as string | null}, ${row.due as string | null}, ${JSON.stringify(row.deps)}::jsonb, ${row.gate as string},
        ${row.check as string}, ${row.evidence as string}, ${!!row.critical}, ${row.note as string},
        ${String(row.why || '').slice(0, 2000)}, ${JSON.stringify(row.steps || [])}::jsonb, ${n})
      ON CONFLICT (project_id, code) DO UPDATE SET kind = EXCLUDED.kind, layer = EXCLUDED.layer, title = EXCLUDED.title,
        owner_name = EXCLUDED.owner_name, start_date = EXCLUDED.start_date, due_date = EXCLUDED.due_date, depends_on = EXCLUDED.depends_on,
        gate = EXCLUDED.gate, done_check = EXCLUDED.done_check, evidence = EXCLUDED.evidence, critical = EXCLUDED.critical,
        plan_note = EXCLUDED.plan_note, why = CASE WHEN EXCLUDED.why <> '' THEN EXCLUDED.why ELSE dev_items.why END,
        steps = CASE WHEN jsonb_array_length(EXCLUDED.steps) > 0 THEN EXCLUDED.steps ELSE dev_items.steps END,
        sort = EXCLUDED.sort, archived = false, updated_at = now()`;
    n += 1;
  };
  for (const g of gates) {
    const code = s(g.id, 20);
    if (!code) continue;
    await put(code, { kind: 'gate', layer: 'Gates', title: s(g.name, 200), owner: 'Chad', start: day(g.date), due: day(g.date), deps: [],
      gate: code, check: s(g.test, 1200), evidence: '', critical: true, note: s(g.fail_action, 600), why: g.why, steps: readSteps(g.steps) });
  }
  for (const it of items) {
    const code = s(it.id, 20);
    if (!code || !s(it.title, 10)) continue;
    const deps = Array.isArray(it.depends_on) ? it.depends_on.map((d) => s(d, 20)).filter(Boolean).slice(0, 20) : [];
    await put(code, { kind: 'deliverable', layer: s(it.layer, 80), title: s(it.title, 200), owner: s(it.owner, 80), start: day(it.start),
      due: day(it.due), deps, gate: s(it.gate || '', 20), check: s(it.done_check, 1200), evidence: s(it.evidence, 300),
      critical: !!it.critical_path, note: s(it.note, 800), why: it.why, steps: readSteps(it.steps) });
  }
  await log(sql, ownerId, projectId, null, '', 'import', { name, gates: gates.length, deliverables: items.length });
  return { projectId, count: n };
}

/** Change one item: stage, check result or note. Each change is logged with the value before and after. */
export async function patchItem(sql: Sql, ownerId: string, id: string, body: Record<string, unknown>) {
  await ensureDev(sql);
  const cur = (await sql`SELECT id::text, project_id::text, code, stage, check_state, note, archived FROM dev_items
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} LIMIT 1`)[0] as Record<string, unknown> | undefined;
  if (!cur) return null;
  const stage = body.stage != null && (STAGES as readonly string[]).includes(String(body.stage)) ? String(body.stage) : null;
  const check = body.check != null && (CHECKS as readonly string[]).includes(String(body.check)) ? String(body.check) : null;
  const note = body.note != null ? String(body.note).slice(0, 4000) : null;
  const archived = typeof body.archived === 'boolean' ? body.archived : null;
  const stepIx = Number.isInteger(body.step) && Number(body.step) >= 0 && Number(body.step) < 30 ? String(body.step) : null;
  if (stepIx != null) {
    const on = !!body.stepDone;
    await sql`UPDATE dev_items SET step_done = CASE WHEN ${on} THEN step_done || jsonb_build_object(${stepIx}::text, true) ELSE step_done - ${stepIx}::text END,
      updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
    await log(sql, ownerId, String(cur.project_id), id, String(cur.code), 'change', { step: [Number(stepIx) + 1, on] });
  }
  await sql`UPDATE dev_items SET stage = COALESCE(${stage}, stage), check_state = COALESCE(${check}, check_state),
      note = COALESCE(${note}, note), archived = COALESCE(${archived}::boolean, archived), updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  const detail: Record<string, unknown> = {};
  if (stage && stage !== cur.stage) detail.stage = [cur.stage, stage];
  if (check && check !== cur.check_state) detail.check = [cur.check_state, check];
  if (note != null && note !== cur.note) detail.note = true;
  if (archived != null && archived !== cur.archived) detail.archived = archived;
  if (Object.keys(detail).length) await log(sql, ownerId, String(cur.project_id), id, String(cur.code), 'change', detail);
  return true;
}

/** A deliverable added by hand to a project. */
export async function addItem(sql: Sql, ownerId: string, projectId: string, body: Record<string, unknown>) {
  await ensureDev(sql);
  const own = await sql`SELECT 1 FROM dev_projects WHERE id = ${projectId}::uuid AND owner_id = ${ownerId}`;
  if (!own.length) return null;
  const title = s(body.title, 200);
  if (!title) throw new Error('Name the deliverable.');
  const code = s(body.code, 20) || `N${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const rows = await sql`INSERT INTO dev_items (owner_id, project_id, code, kind, layer, title, owner_name, due_date, done_check, evidence, sort)
    VALUES (${ownerId}, ${projectId}::uuid, ${code}, 'deliverable', ${s(body.layer, 80) || 'Added'}, ${title}, ${s(body.owner, 80)},
      ${day(body.due)}, ${s(body.done_check, 1200)}, ${s(body.evidence, 300)}, 9000)
    ON CONFLICT (project_id, code) DO NOTHING RETURNING id::text`;
  if (rows[0]) await log(sql, ownerId, projectId, String(rows[0].id), code, 'add', { title });
  return rows[0] ? String(rows[0].id) : null;
}

/**
 * Development feeds the rest of the site (31 Oct 2026).
 * Timeline: every gate and deliverable is a bar (or a key date) in the Planner's Development pipeline, one stream per layer.
 * Tasks: every deliverable that is open this week (started by Sunday, not passed) is a task in Today and This week,
 * area dev, and is closed there when its check passes. Keyed by the item's id, so a re-run updates instead of duplicating.
 * ownerId owns the plan; userId is the signed-in user whose Planner and tasks are written (the same person for Chad).
 */
const lastSync = new Map<string, number>();
export async function syncDevOut(sql: Sql, ownerId: string, userId: string, force = false) {
  if (!force && Date.now() - (lastSync.get(ownerId) || 0) < 10 * 60000) return { skipped: true };
  lastSync.set(ownerId, Date.now());
  await ensureDev(sql);
  const rows = (await sql`SELECT i.id::text, i.code, i.kind, i.layer, i.title, i.owner_name, i.start_date::text AS start_date, i.due_date::text AS due_date,
      i.check_state, i.stage, i.archived, i.critical, p.name AS project, p.archived AS project_archived
    FROM dev_items i JOIN dev_projects p ON p.id = i.project_id WHERE i.owner_id = ${ownerId}`) as Array<Record<string, unknown>>;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const sunday = new Date(Date.parse(`${today}T12:00:00Z`) + ((7 - dow) % 7) * 86400000).toISOString().slice(0, 10);
  let timeline = 0, tasks = 0;
  for (const r of rows) {
    const gone = !!r.archived || !!r.project_archived;
    const passed = r.check_state === 'pass' || r.stage === 'done';
    const due = (r.due_date as string) || null;
    const start = (r.start_date as string) || due;
    const key = `dev:${r.id}`;
    const title = `${r.code} ${r.title}`.slice(0, 180);
    if (due) {
      const isDate = r.kind === 'gate' || start === due;
      await sql`INSERT INTO timeline_items (owner_id, seed_key, pipeline, stream, title, kind, start_date, due_date, owner_name, note, status_override, position)
        VALUES (${userId}, ${key}, 'development', ${String(r.layer || 'Development').slice(0, 80)}, ${title}, ${isDate ? 'key_date' : 'span'},
          ${isDate ? null : start}, ${due}, ${String(r.owner_name || '')}, ${String(r.project || '')}, ${passed ? 'done' : null}, 0)
        ON CONFLICT (owner_id, seed_key) WHERE seed_key IS NOT NULL DO UPDATE SET stream = EXCLUDED.stream, title = EXCLUDED.title,
          kind = EXCLUDED.kind, start_date = EXCLUDED.start_date, due_date = EXCLUDED.due_date, owner_name = EXCLUDED.owner_name,
          status_override = EXCLUDED.status_override, archived_at = ${gone ? new Date().toISOString() : null}, updated_at = now()`;
      timeline += 1;
    }
    if (r.kind === 'gate') continue;
    const thisWeek = !!start && start <= sunday;
    const existing = (await sql`SELECT id, status FROM items WHERE owner_id = ${userId} AND source = 'development' AND source_id = ${r.id as string} LIMIT 1`)[0] as
      { id: string; status: string } | undefined;
    if (existing) {
      const want = gone ? 'dropped' : passed ? 'done' : existing.status === 'done' || existing.status === 'dropped' ? 'new' : existing.status;
      {
        await sql`UPDATE items SET status = ${want}, title = ${title}, due = ${due ? `${due}T23:00:00-08:00` : null}, owner = ${String(r.owner_name || '')},
          priority = ${r.critical ? 'high' : 'normal'}, updated_at = now() WHERE id = ${existing.id}`;
      }
      tasks += 1;
    } else if (thisWeek && !passed && !gone) {
      await sql`INSERT INTO items (owner_id, title, area, status, priority, due, owner, source, source_id, category)
        VALUES (${userId}, ${title}, 'dev', 'new', ${r.critical ? 'high' : 'normal'}, ${due ? `${due}T23:00:00-08:00` : null},
          ${String(r.owner_name || '')}, 'development', ${r.id as string}, 'Development')
        ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL DO NOTHING`;
      tasks += 1;
    }
  }
  await sql`INSERT INTO dev_log (owner_id, action, detail) VALUES (${ownerId}, 'sync', ${JSON.stringify({ timeline, tasks })}::jsonb)`;
  return { timeline, tasks };
}
