import type { NeonQueryFunction } from '@neondatabase/serverless';
import { addGhlTask, ensureGhlContact, sendViaGhl } from './ghl';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

/* A stage package is what goes out when a contact lands on a GoHighLevel stage:
   one email (subject, body, document links), an optional follow-up date and an optional GoHighLevel task.
   Every send is logged in stage_sends so each stage can be measured. */

const s = (v: unknown, n = 2000) => String(v == null ? '' : v).slice(0, n);
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export type StageDoc = { name: string; url: string };
export type StagePackage = {
  id: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  subject: string;
  body: string;
  docs: StageDoc[];
  spaceId: string;
  followDays: number;
  task: string;
  active: boolean;
  updatedAt: string;
};

let ready: Promise<void> | null = null;
/* One shared promise, so parallel callers never race the CREATE statements. */
export function ensureStagePackages(sql: Sql) {
  if (!ready) ready = createTables(sql).catch((err) => { ready = null; throw err; });
  return ready;
}
async function createTables(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS stage_packages (
    id text PRIMARY KEY,
    owner_id text NOT NULL,
    pipeline_id text NOT NULL,
    pipeline_name text NOT NULL DEFAULT '',
    stage_id text NOT NULL,
    stage_name text NOT NULL DEFAULT '',
    subject text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    docs jsonb NOT NULL DEFAULT '[]'::jsonb,
    space_id text NOT NULL DEFAULT '',
    follow_days int NOT NULL DEFAULT 0,
    task text NOT NULL DEFAULT '',
    active boolean NOT NULL DEFAULT true,
    deleted_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS stage_packages_owner_stage ON stage_packages (owner_id, stage_id)`;
  await sql`CREATE TABLE IF NOT EXISTS stage_sends (
    id bigserial PRIMARY KEY,
    owner_id text NOT NULL,
    package_id text NOT NULL DEFAULT '',
    pipeline_id text NOT NULL DEFAULT '',
    stage_id text NOT NULL DEFAULT '',
    stage_name text NOT NULL DEFAULT '',
    record_id text NOT NULL DEFAULT '',
    contact_name text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    subject text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    test boolean NOT NULL DEFAULT false,
    at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS stage_sends_owner_stage ON stage_sends (owner_id, stage_id, at DESC)`;
}

function cleanDocs(v: unknown): StageDoc[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((d) => ({ name: s((d as StageDoc)?.name, 160).trim(), url: s((d as StageDoc)?.url, 600).trim() }))
    .filter((d) => d.name && /^https:\/\//i.test(d.url))
    .slice(0, 20);
}

function shape(r: Record<string, unknown>): StagePackage {
  return {
    id: String(r.id),
    pipelineId: String(r.pipeline_id || ''),
    pipelineName: String(r.pipeline_name || ''),
    stageId: String(r.stage_id || ''),
    stageName: String(r.stage_name || ''),
    subject: String(r.subject || ''),
    body: String(r.body || ''),
    docs: cleanDocs(r.docs),
    spaceId: String(r.space_id || ''),
    followDays: Number(r.follow_days) || 0,
    task: String(r.task || ''),
    active: r.active !== false,
    updatedAt: r.updated_at ? new Date(String(r.updated_at)).toISOString() : '',
  };
}

export async function listStagePackages(sql: Sql, ownerId: string) {
  await ensureStagePackages(sql);
  const rows = await sql`SELECT * FROM stage_packages WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY pipeline_name, stage_name`;
  return (rows as Record<string, unknown>[]).map(shape);
}

export async function stagePackageFor(sql: Sql, ownerId: string, stageId: string) {
  await ensureStagePackages(sql);
  const rows = await sql`SELECT * FROM stage_packages WHERE owner_id = ${ownerId} AND stage_id = ${s(stageId, 64)} AND deleted_at IS NULL AND active LIMIT 1`;
  return rows[0] ? shape(rows[0] as Record<string, unknown>) : null;
}

export async function saveStagePackage(sql: Sql, ownerId: string, b: Record<string, unknown>) {
  await ensureStagePackages(sql);
  const stageId = s(b.stageId, 64);
  const pipelineId = s(b.pipelineId, 64);
  if (!ID.test(stageId) || !ID.test(pipelineId)) throw new Error('bad stage');
  const id = `${ownerId.slice(0, 24)}:${stageId}`.slice(0, 120);
  const docs = JSON.stringify(cleanDocs(b.docs));
  const follow = Math.max(0, Math.min(90, Math.round(Number(b.followDays) || 0)));
  const rows = await sql`INSERT INTO stage_packages (id, owner_id, pipeline_id, pipeline_name, stage_id, stage_name, subject, body, docs, space_id, follow_days, task, active, deleted_at, updated_at)
    VALUES (${id}, ${ownerId}, ${pipelineId}, ${s(b.pipelineName, 80)}, ${stageId}, ${s(b.stageName, 80)}, ${s(b.subject, 200)}, ${s(b.body, 8000)},
      ${docs}::jsonb, ${s(b.spaceId, 64)}, ${follow}, ${s(b.task, 200)}, ${b.active !== false}, NULL, now())
    ON CONFLICT (owner_id, stage_id) DO UPDATE SET pipeline_id = EXCLUDED.pipeline_id, pipeline_name = EXCLUDED.pipeline_name, stage_name = EXCLUDED.stage_name,
      subject = EXCLUDED.subject, body = EXCLUDED.body, docs = EXCLUDED.docs, space_id = EXCLUDED.space_id, follow_days = EXCLUDED.follow_days,
      task = EXCLUDED.task, active = EXCLUDED.active, deleted_at = NULL, updated_at = now()
    RETURNING *`;
  return shape(rows[0] as Record<string, unknown>);
}

/** Soft delete; restore brings it back exactly as it was. */
export async function removeStagePackage(sql: Sql, ownerId: string, stageId: string, restore = false) {
  await ensureStagePackages(sql);
  await sql`UPDATE stage_packages SET deleted_at = CASE WHEN ${restore} THEN NULL ELSE now() END, updated_at = now()
    WHERE owner_id = ${ownerId} AND stage_id = ${s(stageId, 64)}`;
}

/** Per-stage numbers for the builder: sent in 30 days, all time, failed, last send. */
export async function stageStats(sql: Sql, ownerId: string) {
  await ensureStagePackages(sql);
  const rows = await sql`SELECT stage_id,
      count(*) FILTER (WHERE status = 'sent' AND NOT test) AS sent,
      count(*) FILTER (WHERE status = 'sent' AND NOT test AND at > now() - interval '30 days') AS sent30,
      count(*) FILTER (WHERE status <> 'sent' AND NOT test) AS failed,
      max(at) FILTER (WHERE status = 'sent' AND NOT test) AS last
    FROM stage_sends WHERE owner_id = ${ownerId} GROUP BY stage_id`;
  const out: Record<string, { sent: number; sent30: number; failed: number; last: string }> = {};
  for (const r of rows as Record<string, unknown>[]) {
    out[String(r.stage_id)] = { sent: Number(r.sent) || 0, sent30: Number(r.sent30) || 0, failed: Number(r.failed) || 0, last: r.last ? new Date(String(r.last)).toISOString() : '' };
  }
  return out;
}

export async function recentSends(sql: Sql, ownerId: string, stageId: string) {
  await ensureStagePackages(sql);
  const rows = await sql`SELECT contact_name, email, subject, status, note, test, at FROM stage_sends
    WHERE owner_id = ${ownerId} AND stage_id = ${s(stageId, 64)} ORDER BY at DESC LIMIT 25`;
  return rows as Record<string, unknown>[];
}

/** Space documents ride along as links, read at send time so a newly added document goes out too. */
async function spaceDocs(sql: Sql, ownerId: string, spaceId: string): Promise<StageDoc[]> {
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) return [];
  try {
    const rows = await sql`SELECT d.name, d.url FROM package_docs d JOIN packages p ON p.id = d.package_id
      WHERE p.id = ${spaceId} AND p.owner_id = ${ownerId} AND p.deleted_at IS NULL AND d.deleted_at IS NULL ORDER BY d.name`;
    return cleanDocs(rows);
  } catch {
    try {
      const rows = await sql`SELECT d.name, d.url FROM package_docs d JOIN packages p ON p.id = d.package_id
        WHERE p.id = ${spaceId} AND p.owner_id = ${ownerId} ORDER BY d.name`;
      return cleanDocs(rows);
    } catch (err) {
      fail('stage_space_docs', err);
      return [];
    }
  }
}

export async function listSpacesLite(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`SELECT p.id, p.name, (SELECT count(*) FROM package_docs d WHERE d.package_id = p.id AND d.deleted_at IS NULL) AS docs
      FROM packages p WHERE p.owner_id = ${ownerId} AND p.deleted_at IS NULL ORDER BY p.name LIMIT 200`;
    return (rows as Record<string, unknown>[]).map((r) => ({ id: String(r.id), name: String(r.name || ''), docs: Number(r.docs) || 0 }));
  } catch {
    try {
      const rows = await sql`SELECT id, name FROM packages WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY name LIMIT 200`;
      return (rows as Record<string, unknown>[]).map((r) => ({ id: String(r.id), name: String(r.name || ''), docs: 0 }));
    } catch (err) {
      fail('stage_spaces', err);
      return [];
    }
  }
}

function firstEmail(v: unknown) {
  return (String(v || '').match(/[^\s<>,;|]+@[^\s<>,;|]+\.[a-z]{2,}/i) || [''])[0].toLowerCase();
}

function firstPerson(rec: Record<string, unknown>) {
  if (rec.list === 'angels') return String(rec.name || '');
  const p = String(rec.contact || '').split(/\s*[|;,]\s*/)[0] || '';
  return p && !/@|^\+?\d|contact|leadership|executive|operations|team/i.test(p) ? p : '';
}

function fill(text: string, rec: Record<string, unknown>) {
  const person = firstPerson(rec);
  const first = person.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || 'there';
  const company = rec.list === 'angels' ? '' : String(rec.name || '');
  return text.replaceAll('{{first_name}}', first).replaceAll('{{company}}', company || 'your team').replaceAll('{{name}}', person || company);
}

/** Exactly what would go out for this record at this stage. Nothing is sent here. */
export async function previewStageSend(sql: Sql, ownerId: string, rec: Record<string, unknown>, stageId: string) {
  const pkg = await stagePackageFor(sql, ownerId, stageId);
  if (!pkg) return null;
  const docs = [...pkg.docs, ...(await spaceDocs(sql, ownerId, pkg.spaceId))];
  const to = firstEmail(rec.email);
  return {
    packageId: pkg.id,
    stageName: pkg.stageName,
    to,
    toName: firstPerson(rec) || String(rec.name || ''),
    subject: fill(pkg.subject, rec),
    body: fill(pkg.body, rec),
    docs,
    followDays: pkg.followDays,
    task: pkg.task,
    ready: !!to && !!pkg.subject.trim() && !!pkg.body.trim(),
    why: !to ? 'No email on this contact' : !pkg.subject.trim() || !pkg.body.trim() ? 'The package has no subject or body yet' : '',
  };
}

function escHtml(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function toHtml(body: string, docs: StageDoc[]) {
  const text = escHtml(body).replace(/\r?\n/g, '<br>');
  if (!docs.length) return text;
  const list = docs.map((d) => `<li><a href="${escHtml(d.url)}">${escHtml(d.name)}</a></li>`).join('');
  return `${text}<br><br><b>Attached</b><ul>${list}</ul>`;
}

/**
 * Send this stage's package to one record through GoHighLevel and log it.
 * Caller has already confirmed with Chad. `test` sends to Chad's own address instead and is logged as a test.
 */
export async function sendStagePackage(
  sql: Sql,
  ownerId: string,
  rec: Record<string, unknown>,
  stageId: string,
  opts: { contactId?: string; test?: boolean; testTo?: string } = {},
) {
  const pv = await previewStageSend(sql, ownerId, rec, stageId);
  if (!pv) return { ok: false, note: 'No package on this stage' };
  const to = opts.test ? firstEmail(opts.testTo) : pv.to;
  const log = async (status: string, note: string) => {
    try {
      await sql`INSERT INTO stage_sends (owner_id, package_id, pipeline_id, stage_id, stage_name, record_id, contact_name, email, subject, status, note, test)
        VALUES (${ownerId}, ${pv.packageId}, '', ${s(stageId, 64)}, ${s(pv.stageName, 80)}, ${s(rec.id, 40)}, ${s(pv.toName, 120)}, ${s(to, 200)}, ${s(pv.subject, 200)}, ${status}, ${s(note, 300)}, ${!!opts.test})`;
    } catch (err) {
      fail('stage_send_log', err);
    }
  };
  if (!to || !pv.subject.trim() || !pv.body.trim()) {
    await log('skipped', pv.why || 'No email');
    return { ok: false, note: pv.why || 'No email' };
  }
  let contactId = opts.test ? '' : s(opts.contactId, 64);
  if (!contactId) contactId = await ensureGhlContact({ name: opts.test ? 'Chad Johnston' : pv.toName, company: opts.test ? '4orm Finance' : String(rec.name || ''), email: to });
  if (!contactId) {
    await log('failed', 'GoHighLevel did not find or add the contact');
    return { ok: false, note: 'GoHighLevel did not find or add the contact' };
  }
  const sent = await sendViaGhl({ contactId, email: to, subject: (opts.test ? '[TEST] ' : '') + pv.subject, html: toHtml(pv.body, pv.docs) });
  if (!sent) {
    await log('failed', 'GoHighLevel did not send it');
    return { ok: false, note: 'GoHighLevel did not send it' };
  }
  if (!opts.test && pv.task.trim()) {
    await addGhlTask(contactId, fill(pv.task, rec)).catch(() => null);
  }
  await log('sent', opts.test ? 'Test to Chad' : '');
  return { ok: true, to, subject: pv.subject, followDays: pv.followDays, docs: pv.docs.length };
}
