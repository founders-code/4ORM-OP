import { brotliDecompressSync } from 'node:zlib';
import type { Sql } from './db';
import { fail } from './log';

/* Growth lists: the ranked BC master (revenue, investment, regulation) with every original field kept in data,
   plus tracking Chad edits himself (status, stage, notes, next date, plan day) and an outreach log. */

export const GROWTH_LISTS: Array<{ key: string; name: string; grp: string; perDay: number; channel: string; blurb: string }> = [
  { key: 'design', name: 'Design partners', grp: 'revenue', perDay: 10, channel: 'Call', blurb: 'Best BC workflow partners first' },
  { key: 'clients', name: 'Client targets', grp: 'revenue', perDay: 5, channel: 'Call', blurb: 'Buyers for the paid assessment' },
  { key: 'prospects', name: 'Prospects', grp: 'revenue', perDay: 5, channel: 'Email', blurb: 'Wider revenue pipeline' },
  { key: 'channels', name: 'Distribution channels', grp: 'revenue', perDay: 2, channel: 'Email', blurb: 'Associations and partners' },
  { key: 'angels', name: 'Angels (people)', grp: 'investment', perDay: 10, channel: 'LinkedIn', blurb: 'Individual investors, LinkedIn first' },
  { key: 'firms_now', name: 'Firms and funds: reach now', grp: 'investment', perDay: 5, channel: 'Form', blurb: 'VCs, angel groups and offices with a current fit' },
  { key: 'new_funds', name: 'New funds 2024-26', grp: 'investment', perDay: 3, channel: 'Email', blurb: 'Fresh funds putting money out' },
  { key: 'firms_later', name: 'Firms and funds: later', grp: 'investment', perDay: 0, channel: 'Email', blurb: 'Weaker fit, keep for later' },
  { key: 'programs', name: 'Grants and programs', grp: 'investment', perDay: 1, channel: 'Form', blurb: 'Grants, accelerators, tax credits' },
  { key: 'regulators', name: 'Regulators', grp: 'regulation', perDay: 2, channel: 'Email', blurb: 'Scoped questions, BC first' },
  { key: 'index', name: 'Wider contact index', grp: 'revenue', perDay: 0, channel: 'Email', blurb: 'Not ranked in the BC master; kept so nothing is lost' },
];

/* What Chad works now (top of Lists) and the full masters (bottom). Working lists are slices of the masters. */
export type GrowthView = { key: string; name: string; sub: string; kind: string; perDay: number; master: boolean; pick: (rows: Array<Record<string, unknown>>) => Array<Record<string, unknown>> };
const byList = (rows: Array<Record<string, unknown>>, keys: string[]) => rows.filter((r) => keys.includes(String(r.list)));
const byNum = (k: string) => (a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a[k]) || 1e9) - (Number(b[k]) || 1e9);
const VC_TYPES = /^(VC|MICRO_VC|CORPORATE_VC|VC fund|VC \(new fund\))$/;
export const GROWTH_VIEWS: GrowthView[] = [
  { key: 'w-design', name: 'Design partners: first 50', sub: '10 calls a day', kind: 'design', perDay: 10, master: false,
    pick: (rows) => byList(rows, ['design']).sort(byNum('rank')).slice(0, 50) },
  { key: 'w-clients', name: 'Client targets: first 25', sub: '5 a day', kind: 'design', perDay: 5, master: false,
    pick: (rows) => byList(rows, ['clients']).sort(byNum('rank')).slice(0, 25) },
  { key: 'w-vcs', name: 'VCs: 75 to 125', sub: '5 a day · top 75 held back', kind: 'vc', perDay: 5, master: false,
    pick: (rows) => byList(rows, ['firms_now', 'firms_later', 'new_funds']).filter((r) => VC_TYPES.test(String(r.type)) || r.vcrank).sort(byNum('vcrank')).slice(74, 125) },
  { key: 'w-angels', name: 'Angels: 75 to 125', sub: '10 LinkedIn messages a day', kind: 'vc', perDay: 10, master: false,
    pick: (rows) => byList(rows, ['angels']).sort(byNum('rank')).slice(74, 125) },
  { key: 'w-newfunds', name: 'New funds 2024-26', sub: '3 a day', kind: 'vc', perDay: 3, master: false,
    pick: (rows) => byList(rows, ['new_funds']).sort(byNum('rank')) },
  { key: 'w-regulators', name: 'Regulators: first 20', sub: '2 a day · scoped questions', kind: 'regulator', perDay: 2, master: false,
    pick: (rows) => byList(rows, ['regulators']).sort(byNum('rank')).slice(0, 20) },
  { key: 'm-revenue', name: 'Master: revenue', sub: 'Design partners, clients, prospects, channels', kind: 'master', perDay: 0, master: true,
    pick: (rows) => byList(rows, ['design', 'clients', 'prospects', 'channels']).sort(byNum('grank')) },
  { key: 'm-firms', name: 'Master: firms and funds', sub: 'VCs, angel groups, offices, incubators, funds', kind: 'master', perDay: 0, master: true,
    pick: (rows) => byList(rows, ['new_funds', 'firms_now', 'firms_later']).sort(byNum('grank')) },
  { key: 'm-angels', name: 'Master: angels (people)', sub: 'Individual investors', kind: 'master', perDay: 0, master: true,
    pick: (rows) => byList(rows, ['angels']).sort(byNum('rank')) },
  { key: 'm-regulators', name: 'Master: regulators', sub: 'Regulators and public bodies', kind: 'master', perDay: 0, master: true,
    pick: (rows) => byList(rows, ['regulators']).sort(byNum('rank')) },
  { key: 'm-programs', name: 'Master: grants and programs', sub: 'Grants, accelerators, tax credits', kind: 'master', perDay: 0, master: true,
    pick: (rows) => byList(rows, ['programs']).sort(byNum('rank')) },
  { key: 'm-index', name: 'Master: wider contact index', sub: 'Not ranked; nothing lost', kind: 'master', perDay: 0, master: true,
    pick: (rows) => byList(rows, ['index']).sort(byNum('rank')) },
];

export async function ensureGrowth(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS growth_records (
    owner_id text NOT NULL,
    id text NOT NULL,
    list text NOT NULL,
    grp text NOT NULL,
    rank int NOT NULL DEFAULT 0,
    grank int NOT NULL DEFAULT 0,
    priority text NOT NULL DEFAULT '',
    score text NOT NULL DEFAULT '',
    name text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT '',
    contact text NOT NULL DEFAULT '',
    title text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    linkedin text NOT NULL DEFAULT '',
    website text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    prov text NOT NULL DEFAULT '',
    route text NOT NULL DEFAULT '',
    next_action text NOT NULL DEFAULT '',
    why text NOT NULL DEFAULT '',
    constraint_note text NOT NULL DEFAULT '',
    evidence text NOT NULL DEFAULT '',
    owner_name text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'Not contacted',
    stage text NOT NULL DEFAULT 'Cold',
    sources text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    plan_day date,
    next_date date,
    last_touch timestamptz,
    edited jsonb NOT NULL DEFAULT '{}'::jsonb,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    deleted_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS growth_records_list ON growth_records (owner_id, list, rank)`;
  await sql`CREATE TABLE IF NOT EXISTS growth_touches (
    id bigserial PRIMARY KEY,
    owner_id text NOT NULL,
    record_id text NOT NULL,
    at timestamptz NOT NULL DEFAULT now(),
    channel text NOT NULL DEFAULT '',
    outcome text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    next_date date,
    deleted_at timestamptz
  )`;
  await sql`CREATE INDEX IF NOT EXISTS growth_touches_owner ON growth_touches (owner_id, at DESC)`;
}

const s = (v: unknown, n = 2000) => String(v == null ? '' : v).slice(0, n);

/** Records arrive from Chad's signed-in browser in base64 parts (brotli JSON), then get assembled here. */
export async function saveUploadPart(sql: Sql, ownerId: string, uploadId: string, part: number, body: string) {
  await sql`CREATE TABLE IF NOT EXISTS growth_uploads (owner_id text NOT NULL, upload_id text NOT NULL, part int NOT NULL, body text NOT NULL,
    at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (owner_id, upload_id, part))`;
  await sql`INSERT INTO growth_uploads (owner_id, upload_id, part, body) VALUES (${ownerId}, ${uploadId}, ${part}, ${body})
    ON CONFLICT (owner_id, upload_id, part) DO UPDATE SET body = EXCLUDED.body`;
}

export async function finishUpload(sql: Sql, ownerId: string, uploadId: string) {
  const rows = (await sql`SELECT body FROM growth_uploads WHERE owner_id = ${ownerId} AND upload_id = ${uploadId} ORDER BY part`) as Array<{ body: string }>;
  const buf = Buffer.from(rows.map((r) => r.body).join(''), 'base64');
  const seed = JSON.parse(brotliDecompressSync(buf).toString('utf8')) as { records: Array<Record<string, unknown>> };
  const n = await importGrowth(sql, ownerId, seed.records || []);
  await sql`DELETE FROM growth_uploads WHERE owner_id = ${ownerId} AND upload_id = ${uploadId}`;
  return n;
}

const TOP_FIELDS = ['id', 'list', 'grp', 'rank', 'grank', 'priority', 'score', 'name', 'type', 'contact', 'title', 'email', 'phone', 'linkedin', 'website', 'city', 'prov', 'route', 'next', 'why', 'constraint', 'evidence', 'owner', 'status', 'sources'];

/** Upsert records. Research fields refresh; anything Chad edited (listed in `edited`) and all tracking stays. */
export async function importGrowth(sql: Sql, ownerId: string, records: Array<Record<string, unknown>>) {
  await ensureGrowth(sql);
  let n = 0;
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200).map((r) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) if (!TOP_FIELDS.includes(k)) data[k] = v;
      return {
        id: s(r.id, 40), list: s(r.list, 40), grp: s(r.grp, 20), rank: Number(r.rank) || 0, grank: Number(r.grank) || 0,
        priority: s(r.priority, 4), score: s(r.score, 10), name: s(r.name, 300), type: s(r.type, 80), contact: s(r.contact, 600),
        title: s(r.title, 300), email: s(r.email, 300), phone: s(r.phone, 120), linkedin: s(r.linkedin, 400), website: s(r.website, 500),
        city: s(r.city, 120), prov: s(r.prov, 40), route: s(r.route, 600), next_action: s(r.next, 800), why: s(r.why, 1200),
        constraint_note: s(r.constraint, 1200), evidence: s(r.evidence, 400), owner_name: s(r.owner, 80), sources: s(r.sources, 800),
        orig_status: s(r.status, 80), data,
      };
    });
    await sql`
      INSERT INTO growth_records (owner_id, id, list, grp, rank, grank, priority, score, name, type, contact, title, email, phone, linkedin,
        website, city, prov, route, next_action, why, constraint_note, evidence, owner_name, sources, data)
      SELECT ${ownerId}, x.id, x.list, x.grp, x.rank, x.grank, x.priority, x.score, x.name, x.type, x.contact, x.title, x.email, x.phone,
        x.linkedin, x.website, x.city, x.prov, x.route, x.next_action, x.why, x.constraint_note, x.evidence, x.owner_name, x.sources,
        x.data || jsonb_build_object('orig_status', x.orig_status)
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(id text, list text, grp text, rank int, grank int, priority text, score text,
        name text, type text, contact text, title text, email text, phone text, linkedin text, website text, city text, prov text, route text,
        next_action text, why text, constraint_note text, evidence text, owner_name text, sources text, orig_status text, data jsonb)
      ON CONFLICT (owner_id, id) DO UPDATE SET
        list = CASE WHEN growth_records.edited ? 'list' THEN growth_records.list ELSE EXCLUDED.list END,
        rank = CASE WHEN growth_records.edited ? 'rank' THEN growth_records.rank ELSE EXCLUDED.rank END,
        grank = EXCLUDED.grank,
        priority = CASE WHEN growth_records.edited ? 'priority' THEN growth_records.priority ELSE EXCLUDED.priority END,
        score = EXCLUDED.score,
        name = CASE WHEN growth_records.edited ? 'name' THEN growth_records.name ELSE EXCLUDED.name END,
        contact = CASE WHEN growth_records.edited ? 'contact' THEN growth_records.contact ELSE EXCLUDED.contact END,
        email = CASE WHEN growth_records.edited ? 'email' THEN growth_records.email ELSE EXCLUDED.email END,
        phone = CASE WHEN growth_records.edited ? 'phone' THEN growth_records.phone ELSE EXCLUDED.phone END,
        linkedin = CASE WHEN growth_records.edited ? 'linkedin' THEN growth_records.linkedin ELSE EXCLUDED.linkedin END,
        next_action = CASE WHEN growth_records.edited ? 'next_action' THEN growth_records.next_action ELSE EXCLUDED.next_action END,
        why = EXCLUDED.why, constraint_note = EXCLUDED.constraint_note, evidence = EXCLUDED.evidence,
        sources = EXCLUDED.sources, data = EXCLUDED.data, updated_at = now()
    `;
    n += chunk.length;
  }
  return n;
}

const pad = (n: number) => String(n).padStart(2, '0');
function vanToday() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}
function addWeekdays(iso: string, k: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  let left = k;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left -= 1;
  }
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Give every uncontacted record in a working list a weekday, best first, at that list's daily pace, from `start`. */
export async function planDays(sql: Sql, ownerId: string, start: string) {
  const rows = await listGrowth(sql, ownerId, null);
  const out: Record<string, number> = {};
  const seen = new Set<string>();
  for (const v of GROWTH_VIEWS) {
    if (v.master || !v.perDay) continue;
    const ids: string[] = [];
    const days: string[] = [];
    let i = 0;
    for (const r of v.pick(rows)) {
      const id = String(r.id);
      if (seen.has(id)) continue;
      seen.add(id);
      if (r.last_touch || r.plan_day) { i += 1; continue; }
      ids.push(id);
      days.push(addWeekdays(start, Math.floor(i / v.perDay)));
      i += 1;
    }
    if (ids.length) {
      await sql`UPDATE growth_records g SET plan_day = x.d::date FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${days}::text[]) AS d) x
        WHERE g.owner_id = ${ownerId} AND g.id = x.id`;
    }
    out[v.key] = ids.length;
  }
  return out;
}

const EDITABLE: Record<string, number> = {
  name: 300, contact: 600, title: 300, email: 300, phone: 120, linkedin: 400, website: 500, city: 120, prov: 40,
  route: 600, next_action: 800, owner_name: 80, status: 80, stage: 80, notes: 20000, priority: 4, list: 40, type: 80,
};

export async function patchGrowth(sql: Sql, ownerId: string, id: string, body: Record<string, unknown>) {
  await ensureGrowth(sql);
  const cur = (await sql`SELECT * FROM growth_records WHERE owner_id = ${ownerId} AND id = ${id} LIMIT 1`)[0] as Record<string, unknown> | undefined;
  if (!cur) return null;
  const edited = { ...((cur.edited as Record<string, boolean>) || {}) };
  const next: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(EDITABLE)) {
    if (Object.prototype.hasOwnProperty.call(body, k)) { next[k] = s(body[k], max); edited[k] = true; }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'rank')) { next.rank = Math.max(0, Number(body.rank) || 0); edited.rank = true; }
  const dateOrNull = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  const setPlan = Object.prototype.hasOwnProperty.call(body, 'plan_day');
  const setNext = Object.prototype.hasOwnProperty.call(body, 'next_date');
  const setDel = Object.prototype.hasOwnProperty.call(body, 'deleted');
  const v = (k: string) => (k in next ? next[k] : cur[k]);
  const rows = await sql`UPDATE growth_records SET
      name = ${v('name')}, contact = ${v('contact')}, title = ${v('title')}, email = ${v('email')}, phone = ${v('phone')},
      linkedin = ${v('linkedin')}, website = ${v('website')}, city = ${v('city')}, prov = ${v('prov')}, route = ${v('route')},
      next_action = ${v('next_action')}, owner_name = ${v('owner_name')}, status = ${v('status')}, stage = ${v('stage')},
      notes = ${v('notes')}, priority = ${v('priority')}, list = ${v('list')}, type = ${v('type')}, rank = ${v('rank')},
      plan_day = CASE WHEN ${setPlan} THEN ${setPlan ? dateOrNull(body.plan_day) : null}::date ELSE plan_day END,
      next_date = CASE WHEN ${setNext} THEN ${setNext ? dateOrNull(body.next_date) : null}::date ELSE next_date END,
      deleted_at = CASE WHEN ${setDel} THEN (CASE WHEN ${!!body.deleted} THEN now() ELSE NULL END) ELSE deleted_at END,
      edited = ${JSON.stringify(edited)}::jsonb, updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id} RETURNING *`;
  return rows[0] || null;
}

export async function addTouch(sql: Sql, ownerId: string, recordId: string, t: { channel?: string; outcome?: string; note?: string; next_date?: string; status?: string }) {
  await ensureGrowth(sql);
  const nd = /^\d{4}-\d{2}-\d{2}$/.test(String(t.next_date || '')) ? String(t.next_date) : null;
  const row = await sql`INSERT INTO growth_touches (owner_id, record_id, channel, outcome, note, next_date)
    VALUES (${ownerId}, ${s(recordId, 40)}, ${s(t.channel, 40)}, ${s(t.outcome, 80)}, ${s(t.note, 4000)}, ${nd}::date) RETURNING *`;
  const status = s(t.status, 80) || (t.outcome ? s(t.outcome, 80) : 'Contacted');
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const line = t.note ? `${stamp} · ${s(t.outcome, 80) || s(t.channel, 40) || 'Note'}: ${s(t.note, 1000)}` : '';
  await sql`UPDATE growth_records SET last_touch = now(), status = ${status},
      notes = CASE WHEN ${line}::text = '' THEN notes ELSE left(${line}::text || CASE WHEN notes = '' THEN '' ELSE E'\n' || notes END, 8000) END,
      stage = CASE WHEN stage = 'Cold' THEN 'Contacted' ELSE stage END,
      next_date = COALESCE(${nd}::date, next_date), updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${s(recordId, 40)}`;
  return row[0];
}

/** Undo puts the record back: the touch goes, last touch and status come from what is left, and the note line it added is taken off. */
export async function undoTouch(sql: Sql, ownerId: string, touchId: number) {
  const gone = (await sql`UPDATE growth_touches SET deleted_at = now() WHERE owner_id = ${ownerId} AND id = ${touchId} AND deleted_at IS NULL
    RETURNING record_id, outcome, channel, note`)[0] as Record<string, unknown> | undefined;
  if (!gone) return;
  const rid = String(gone.record_id);
  const left = (await sql`SELECT at, outcome FROM growth_touches WHERE owner_id = ${ownerId} AND record_id = ${rid} AND deleted_at IS NULL ORDER BY at DESC LIMIT 1`)[0] as Record<string, unknown> | undefined;
  const cur = (await sql`SELECT notes FROM growth_records WHERE owner_id = ${ownerId} AND id = ${rid}`)[0] as Record<string, unknown> | undefined;
  let notes = String(cur?.notes || '');
  const tail = gone.note ? `${s(gone.outcome, 80) || s(gone.channel, 40) || 'Note'}: ${s(gone.note, 1000)}` : '';
  if (tail) {
    const lines = notes.split('\n');
    const ix = lines.findIndex((l) => l.endsWith(tail));
    if (ix >= 0) { lines.splice(ix, 1); notes = lines.join('\n'); }
  }
  await sql`UPDATE growth_records SET notes = ${notes}, last_touch = ${left ? (left.at as string) : null},
      status = ${left ? (String(left.outcome || '') || 'Contacted') : 'Not contacted'}, updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${rid}`;
}

const LIST_COLS = (sql: Sql, ownerId: string, list: string | null) => (list
  ? sql`SELECT id, list, grp, rank, grank, priority, score, name, type, contact, title, email, phone, linkedin, website, city, prov,
      route, next_action, why, constraint_note, evidence, owner_name, status, stage, sources, notes, plan_day, next_date, last_touch, updated_at
      FROM growth_records WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND list = ${list} ORDER BY rank, grank`
  : sql`SELECT id, list, grp, rank, priority, name, contact, title, email, phone, linkedin, website, city, prov, type, status, stage,
      next_action, plan_day, next_date, last_touch, left(notes, 400) AS notes, grank,
      data->'ranks'->>'VC firm rank' AS vcrank, data->'ghl'->>'stage' AS ghl_stage, data->'ghl'->>'pipeline' AS ghl_pipeline, data->'ranks'->>'Investor rank' AS invrank
      FROM growth_records WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY list, rank`);

export async function listGrowth(sql: Sql, ownerId: string, list: string | null) {
  await ensureGrowth(sql);
  return (await LIST_COLS(sql, ownerId, list)) as Array<Record<string, unknown>>;
}

export async function growthRecord(sql: Sql, ownerId: string, id: string) {
  await ensureGrowth(sql);
  const r = (await sql`SELECT * FROM growth_records WHERE owner_id = ${ownerId} AND id = ${id} LIMIT 1`)[0];
  if (!r) return null;
  const touches = await sql`SELECT id, at, channel, outcome, note, next_date FROM growth_touches
    WHERE owner_id = ${ownerId} AND record_id = ${id} AND deleted_at IS NULL ORDER BY at DESC LIMIT 100`;
  return { ...r, touches };
}

export async function outreachLog(sql: Sql, ownerId: string, days = 60) {
  await ensureGrowth(sql);
  return (await sql`SELECT t.id, t.at, t.channel, t.outcome, t.note, t.next_date, t.record_id, g.name, g.contact, g.list
    FROM growth_touches t LEFT JOIN growth_records g ON g.owner_id = t.owner_id AND g.id = t.record_id
    WHERE t.owner_id = ${ownerId} AND t.deleted_at IS NULL AND t.at > now() - (${days} || ' days')::interval
    ORDER BY t.at DESC LIMIT 500`) as Array<Record<string, unknown>>;
}

export async function growthSummary(sql: Sql, ownerId: string) {
  await ensureGrowth(sql);
  const today = vanToday();
  const rows = (await sql`SELECT list, count(*)::int AS n,
      count(*) FILTER (WHERE last_touch IS NOT NULL)::int AS touched,
      count(*) FILTER (WHERE plan_day = ${today}::date AND last_touch IS NULL)::int AS today,
      count(*) FILTER (WHERE plan_day < ${today}::date AND last_touch IS NULL)::int AS overdue
    FROM growth_records WHERE owner_id = ${ownerId} AND deleted_at IS NULL GROUP BY list`) as Array<Record<string, unknown>>;
  return { today, lists: GROWTH_LISTS.map((l) => ({ ...l, ...(rows.find((r) => r.list === l.key) || { n: 0, touched: 0, today: 0, overdue: 0 }) })) };
}

/** Remember where this record sits in GoHighLevel (contact id, last known opportunity and stage). */
export async function setGrowthGhl(sql: Sql, ownerId: string, id: string, ghl: Record<string, unknown>) {
  await sql`UPDATE growth_records SET data = jsonb_set(data, '{ghl}', ${JSON.stringify(ghl)}::jsonb, true), updated_at = now()
    WHERE owner_id = ${ownerId} AND id = ${id}`;
}

export { vanToday, addWeekdays };
export const safeGrowth = <T>(p: Promise<T>, label: string, fallback: T) => p.catch((err) => { fail(label, err); return fallback; });
