import type { Sql } from './db';
import { fail, note } from './log';
import { PLANNER_SEED } from './planner-seed';

const PIPES = ['corporate', 'capital', 'revenue', 'marketing', 'development', 'partnership', 'regulators', 'team'];

export async function ensureTimeline(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS timeline_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    seed_key text,
    pipeline text NOT NULL,
    stream text NOT NULL DEFAULT '',
    title text NOT NULL,
    kind text NOT NULL,
    start_date date,
    due_date date,
    recur_rule text,
    owner_name text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    status_override text,
    milestone_id uuid,
    position int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
  )`;
  await sql`CREATE TABLE IF NOT EXISTS timeline_deps (
    item_id uuid NOT NULL,
    depends_on_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, depends_on_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS timeline_prefs (
    owner_id text PRIMARY KEY,
    pipeline_order jsonb NOT NULL DEFAULT '[]'::jsonb,
    hidden jsonb NOT NULL DEFAULT '[]'::jsonb,
    open jsonb NOT NULL DEFAULT '[]'::jsonb,
    zoom text NOT NULL DEFAULT '6',
    show_links boolean NOT NULL DEFAULT true,
    one_move_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS timeline_items_seed ON timeline_items (owner_id, seed_key) WHERE seed_key IS NOT NULL`;
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS plan_of uuid`;
  } catch (err) {
    fail('timeline_plan_of', err);
  }
}

function kindOf(row: Record<string, unknown>) {
  if (row.dates) return 'recurring';
  if (String(row.p) === 'goals') return 'milestone';
  if (row.m) return 'key_date';
  return 'span';
}

function noteOf(row: Record<string, unknown>) {
  const bits = [String(row.note || ''), row.src ? `Source: ${row.src}` : '', row.decide ? `Decision: ${row.decide}` : '', row.c ? `Confidence: ${row.c}` : ''];
  return bits.filter(Boolean).join('\n').slice(0, 4000);
}

export async function seedPlanner(sql: Sql, ownerId: string) {
  await ensureTimeline(sql);
  const existing = await sql`SELECT id FROM timeline_items WHERE owner_id = ${ownerId} AND archived_at IS NULL LIMIT 1`;
  if (existing.length) return { seeded: false, n: 0 };
  const map = new Map<string, string>();
  let pos = 0;
  for (const raw of PLANNER_SEED as Record<string, unknown>[]) {
    const pipeline = String(raw.p) === 'goals' ? 'milestones' : String(raw.p || 'corporate');
    const kind = kindOf(raw);
    const start = kind === 'span' ? String(raw.s || '') || null : (raw.m ? String(raw.m) : String(raw.s || '') || null);
    const due = String(raw.m || raw.e || raw.s || '') || null;
    const recur = typeof raw.dates === 'string' ? String(raw.dates) : null;
    const st = String(raw.st || '') === 'done' ? 'done' : null;
    const rows = await sql`
      INSERT INTO timeline_items (owner_id, seed_key, pipeline, stream, title, kind, start_date, due_date, recur_rule, owner_name, note, status_override, position)
      VALUES (${ownerId}, ${String(raw.id)}, ${pipeline}, ${String(raw.t || '')}, ${String(raw.n)}, ${kind}, ${start}, ${due}, ${recur}, ${String(raw.o || '')}, ${noteOf(raw)}, ${st}, ${pos})
      RETURNING id
    `;
    map.set(String(raw.id), String(rows[0]?.id || ''));
    pos += 1;
    const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    const planId = String(rows[0]?.id || '');
    for (const task of tasks) {
      const title = Array.isArray(task) ? String(task[0]) : String((task as { n?: string }).n || '');
      const done = Array.isArray(task) ? !!task[1] : !!(task as { d?: boolean }).d;
      if (!title || !planId) continue;
      await sql`
        INSERT INTO items (owner_id, title, area, status, priority, source, plan_of)
        VALUES (${ownerId}, ${title}, 'other', ${done ? 'done' : 'new'}, 'normal', 'timeline', ${planId}::uuid)
      `;
    }
  }
  for (const raw of PLANNER_SEED as Record<string, unknown>[]) {
    const id = map.get(String(raw.id));
    if (!id) continue;
    const g = raw.g ? map.get(String(raw.g)) : '';
    if (g) await sql`UPDATE timeline_items SET milestone_id = ${g}::uuid WHERE id = ${id}::uuid`;
    const deps = Array.isArray(raw.dep) ? raw.dep.map(String) : [];
    for (const d of deps) {
      const depId = map.get(d);
      if (!depId) continue;
      await sql`INSERT INTO timeline_deps (item_id, depends_on_id) VALUES (${id}::uuid, ${depId}::uuid) ON CONFLICT DO NOTHING`;
    }
  }
  await sql`
    INSERT INTO timeline_prefs (owner_id, pipeline_order, open, zoom)
    VALUES (${ownerId}, ${JSON.stringify(PIPES)}::jsonb, ${JSON.stringify(['milestones', 'capital', 'development'])}::jsonb, '6')
    ON CONFLICT (owner_id) DO NOTHING
  `;
  return { seeded: true, n: PLANNER_SEED.length };
}

function dayNum(iso: unknown) {
  const s = String(iso || '').slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

function expandRecur(rule: string) {
  const dates: number[] = [];
  const start = dayNum('2026-10-01');
  const end = dayNum('2027-06-30');
  if (rule.startsWith('monthly:')) {
    const day = Number(rule.slice(8)) || 1;
    let y = 2026, m = 9;
    for (;;) {
      const d = Math.round(Date.UTC(y, m, day) / 86400000);
      if (d > end) break;
      if (d >= start) dates.push(d);
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  }
  return dates;
}

function designKind(kind: string) {
  if (kind === 'milestone') return 'goal';
  if (kind === 'key_date') return 'ms';
  if (kind === 'recurring') return 'series';
  return 'span';
}

export async function readTimeline(sql: Sql, ownerId: string) {
  await seedPlanner(sql, ownerId);
  const items = await sql`
    SELECT * FROM timeline_items WHERE owner_id = ${ownerId} AND archived_at IS NULL ORDER BY position, created_at
  `;
  const deps = await sql`
    SELECT d.item_id, d.depends_on_id FROM timeline_deps d
    JOIN timeline_items a ON a.id = d.item_id
    JOIN timeline_items b ON b.id = d.depends_on_id
    WHERE a.owner_id = ${ownerId} AND b.owner_id = ${ownerId} AND a.archived_at IS NULL AND b.archived_at IS NULL
  `;
  const tasks = await sql`
    SELECT id, title, status, plan_of FROM items
    WHERE owner_id = ${ownerId} AND plan_of IS NOT NULL AND deleted_at IS NULL
  `;
  const prefsRows = await sql`SELECT * FROM timeline_prefs WHERE owner_id = ${ownerId} LIMIT 1`;
  const prefs = prefsRows[0] || {};
  const depMap: Record<string, string[]> = {};
  (deps as { item_id: string; depends_on_id: string }[]).forEach((d) => {
    const id = String(d.item_id);
    depMap[id] = depMap[id] || [];
    depMap[id].push(String(d.depends_on_id));
  });
  const taskMap: Record<string, { n: string; d: boolean; id: string }[]> = {};
  (tasks as { id: string; title: string; status: string; plan_of: string }[]).forEach((t) => {
    const id = String(t.plan_of);
    taskMap[id] = taskMap[id] || [];
    taskMap[id].push({ n: String(t.title), d: String(t.status) === 'done', id: String(t.id) });
  });
  const shaped = (items as Record<string, unknown>[]).map((row) => {
    const kind = String(row.kind);
    const due = dayNum(row.due_date);
    const start = kind === 'span' ? dayNum(row.start_date) : due;
    const recur = String(row.recur_rule || '');
    const dates = kind === 'recurring' && recur ? expandRecur(recur) : undefined;
    return {
      id: String(row.id),
      p: String(row.pipeline) === 'milestones' ? 'goals' : String(row.pipeline),
      t: String(row.stream || ''),
      n: String(row.title),
      o: String(row.owner_name || ''),
      note: String(row.note || ''),
      dep: depMap[String(row.id)] || [],
      g: row.milestone_id ? String(row.milestone_id) : '',
      st: String(row.status_override || ''),
      tasks: taskMap[String(row.id)] || [],
      kind: designKind(kind),
      s: dates ? dates[0] : start,
      e: dates ? dates[dates.length - 1] : due,
      dates,
      planned: /Confidence: estimated/.test(String(row.note || '')),
    };
  });
  note(`[live-map] timeline items=${shaped.filter((i) => i.kind !== 'goal').length} milestones=${shaped.filter((i) => i.kind === 'goal').length} deps=${deps.length} tasks=${tasks.length}`);
  return {
    prefs: {
      pipeline_order: prefs.pipeline_order || PIPES,
      hidden: prefs.hidden || [],
      open: prefs.open || [],
      zoom: String(prefs.zoom || '6'),
      show_links: prefs.show_links !== false,
      one_move_id: prefs.one_move_id || null,
    },
    items: shaped,
    deps,
    tasks: taskMap,
  };
}

async function wouldCycle(sql: Sql, itemId: string, dependsOn: string) {
  if (itemId === dependsOn) return true;
  const rows = await sql`SELECT item_id, depends_on_id FROM timeline_deps`;
  const map = new Map<string, string[]>();
  (rows as { item_id: string; depends_on_id: string }[]).forEach((r) => {
    const a = String(r.item_id);
    map.set(a, (map.get(a) || []).concat(String(r.depends_on_id)));
  });
  const next = (map.get(itemId) || []).concat(dependsOn);
  map.set(itemId, next);
  const seen = new Set<string>();
  const stack = [dependsOn];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === itemId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    (map.get(cur) || []).forEach((d) => stack.push(d));
  }
  return false;
}

export async function addDep(sql: Sql, ownerId: string, itemId: string, dependsOn: string) {
  const rows = await sql`
    SELECT id, kind FROM timeline_items
    WHERE owner_id = ${ownerId} AND archived_at IS NULL AND (id = ${itemId}::uuid OR id = ${dependsOn}::uuid)
  `;
  if (rows.length < 2) return { ok: false, status: 404 as const };
  const dep = rows.find((r) => String(r.id) === dependsOn);
  if (dep && (String(dep.kind) === 'milestone' || String(dep.kind) === 'recurring')) {
    return { ok: false, status: 409 as const, error: 'Cannot depend on a milestone or recurring item' };
  }
  if (await wouldCycle(sql, itemId, dependsOn)) return { ok: false, status: 409 as const, error: 'Cycle' };
  await sql`INSERT INTO timeline_deps (item_id, depends_on_id) VALUES (${itemId}::uuid, ${dependsOn}::uuid) ON CONFLICT DO NOTHING`;
  return { ok: true as const };
}

export async function archiveItem(sql: Sql, ownerId: string, id: string) {
  const rows = await sql`
    UPDATE timeline_items SET archived_at = now(), updated_at = now()
    WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND archived_at IS NULL
    RETURNING *
  `;
  if (!rows.length) return null;
  const cleared = await sql`UPDATE timeline_items SET milestone_id = NULL WHERE milestone_id = ${id}::uuid AND owner_id = ${ownerId} RETURNING id`;
  const deps = await sql`DELETE FROM timeline_deps WHERE item_id = ${id}::uuid OR depends_on_id = ${id}::uuid RETURNING item_id, depends_on_id`;
  return { row: rows[0], cleared, deps };
}

export async function restoreItem(sql: Sql, ownerId: string, id: string, deps: Array<{ item_id: string; depends_on_id: string }>) {
  await sql`UPDATE timeline_items SET archived_at = NULL, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  for (const d of deps || []) {
    await sql`INSERT INTO timeline_deps (item_id, depends_on_id) VALUES (${d.item_id}::uuid, ${d.depends_on_id}::uuid) ON CONFLICT DO NOTHING`;
  }
}

export async function cleanNewsletterTasks(sql: Sql, ownerId: string) {
  const before = await sql`SELECT count(*)::int AS n FROM items WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND source = 'gmail'`;
  const news = await sql`
    UPDATE items SET deleted_at = now()
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND source = 'gmail'
      AND (title ~* 'unsubscribe|newsletter|digest|receipt' OR title ILIKE 'TEST click-check%')
    RETURNING id
  `;
  const tests = await sql`
    UPDATE items SET deleted_at = now()
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND title ILIKE 'TEST click-check%'
    RETURNING id
  `;
  const after = await sql`SELECT count(*)::int AS n FROM items WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND source = 'gmail'`;
  return { gmailBefore: Number(before[0]?.n || 0), archived: news.length + tests.length, gmailAfter: Number(after[0]?.n || 0) };
}
