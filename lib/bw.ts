import { createHash, createHmac } from 'crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { tokenOk } from './guard.mjs';
import { ensureGhlContact, sendViaGhl } from './ghl';
import { fail } from './log';

/**
 * Bruce's workspace (review build, 30 Oct 2026): his own contacts, lists and group email.
 * Everything is scoped by owner and a workspace key ('bruce'), so nothing mixes with Chad's Contacts.
 * Group email goes out through GoHighLevel, a few dozen per cron run, only after a test of the exact
 * same message went to the test inbox. Every email carries the signature, a mailing address and an
 * unsubscribe link (CASL).
 */
type Sql = NeonQueryFunction<false, false>;
export const WS = 'bruce';
export const TEST_TO = 'chad@4ormfinance.com';
export const SITE = 'https://www.4ormop.com';
const BATCH = 45;

export async function ensureBw(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS bw_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    ws text NOT NULL DEFAULT 'bruce',
    first_name text NOT NULL DEFAULT '',
    last_name text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    company text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    important boolean NOT NULL DEFAULT false,
    unsubscribed_at timestamptz,
    bounced_at timestamptz,
    last_emailed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`;
  await sql`CREATE INDEX IF NOT EXISTS bw_contacts_owner ON bw_contacts (owner_id, ws)`;
  await sql`CREATE TABLE IF NOT EXISTS bw_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    ws text NOT NULL DEFAULT 'bruce',
    name text NOT NULL,
    contact_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bw_settings (
    owner_id text NOT NULL,
    ws text NOT NULL DEFAULT 'bruce',
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (owner_id, ws)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bw_sends (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    ws text NOT NULL DEFAULT 'bruce',
    list_id uuid,
    list_name text NOT NULL DEFAULT '',
    subject text NOT NULL,
    body text NOT NULL,
    hash text NOT NULL,
    kind text NOT NULL DEFAULT 'send',
    total int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'queued',
    created_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bw_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    send_id uuid NOT NULL,
    owner_id text NOT NULL,
    contact_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    detail text NOT NULL DEFAULT '',
    claimed_at timestamptz,
    sent_at timestamptz
  )`;
  await sql`CREATE INDEX IF NOT EXISTS bw_queue_wait ON bw_queue (status, send_id)`;
  await sql`ALTER TABLE bw_contacts ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE bw_contacts ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE bw_contacts ADD COLUMN IF NOT EXISTS next_touch date`;
  await sql`ALTER TABLE bw_contacts ADD COLUMN IF NOT EXISTS stage_pos int NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE bw_sends ADD COLUMN IF NOT EXISTS space_id uuid`;
  await sql`CREATE TABLE IF NOT EXISTS bw_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    contact_id uuid NOT NULL,
    kind text NOT NULL,
    text text NOT NULL DEFAULT '',
    at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS bw_events_contact ON bw_events (owner_id, contact_id, at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS bw_spaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    ws text NOT NULL DEFAULT 'bruce',
    name text NOT NULL,
    note text NOT NULL DEFAULT '',
    grp text NOT NULL DEFAULT 'General',
    links jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bw_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    space_id uuid NOT NULL,
    name text NOT NULL,
    mime text NOT NULL DEFAULT 'application/octet-stream',
    size int NOT NULL DEFAULT 0,
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  )`;
}

export const DEFAULT_STAGES = ['New', 'Contacted', 'Meeting booked', 'Info pack sent', 'Engaged', 'Committed', 'Not now'];

function clip(v: unknown, n: number) { return String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n); }
function lc(v: unknown) { return String(v ?? '').trim().toLowerCase(); }
const EMAIL_RE = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

function shapeContact(r: Record<string, unknown>) {
  return {
    id: String(r.id), first: String(r.first_name || ''), last: String(r.last_name || ''), email: String(r.email || ''),
    phone: String(r.phone || ''), company: String(r.company || ''), city: String(r.city || ''),
    fields: (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, string>,
    important: !!r.important, unsubscribed: !!r.unsubscribed_at, bounced: !!r.bounced_at,
    lastEmailed: r.last_emailed_at ? new Date(String(r.last_emailed_at)).toISOString() : '',
    notes: String(r.notes || ''), stage: String(r.stage || ''), stagePos: Number(r.stage_pos) || 0,
    nextTouch: r.next_touch ? new Date(String(r.next_touch)).toISOString().slice(0, 10) : '',
    created: r.created_at ? new Date(String(r.created_at)).toISOString() : '',
  };
}

export async function bwState(sql: Sql, ownerId: string) {
  await ensureBw(sql);
  const contacts = await sql`SELECT * FROM bw_contacts WHERE owner_id = ${ownerId} AND ws = ${WS} AND deleted_at IS NULL ORDER BY lower(first_name), lower(last_name) LIMIT 20000`;
  const lists = await sql`SELECT id, name, contact_ids, updated_at FROM bw_lists WHERE owner_id = ${ownerId} AND ws = ${WS} AND deleted_at IS NULL ORDER BY updated_at DESC`;
  const sends = await sql`
    SELECT s.id, s.list_name, s.subject, s.kind, s.total, s.status, s.created_at,
      (SELECT count(*)::int FROM bw_queue q WHERE q.send_id = s.id AND q.status = 'sent') AS sent,
      (SELECT count(*)::int FROM bw_queue q WHERE q.send_id = s.id AND q.status = 'failed') AS failed
    FROM bw_sends s WHERE s.owner_id = ${ownerId} AND s.ws = ${WS} ORDER BY s.created_at DESC LIMIT 20`;
  const set = await sql`SELECT data FROM bw_settings WHERE owner_id = ${ownerId} AND ws = ${WS}`;
  const spaces = await sql`SELECT id, name, note, grp, links, updated_at FROM bw_spaces WHERE owner_id = ${ownerId} AND ws = ${WS} AND deleted_at IS NULL ORDER BY updated_at DESC`;
  const files = await sql`SELECT id, space_id, name, mime, size FROM bw_files WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY created_at`;
  const data0 = ((set[0]?.data || {}) as Record<string, unknown>);
  const stages = Array.isArray(data0.stages) && (data0.stages as unknown[]).length ? (data0.stages as string[]) : DEFAULT_STAGES;
  return {
    stages,
    spaces: spaces.map((r) => ({
      id: String(r.id), name: String(r.name), note: String(r.note || ''), group: String(r.grp || 'General'),
      links: Array.isArray(r.links) ? (r.links as Array<{ name: string; url: string }>) : [],
      updated: r.updated_at ? new Date(String(r.updated_at)).toISOString() : '',
      files: files.filter((f) => String(f.space_id) === String(r.id)).map((f) => ({ id: String(f.id), name: String(f.name), mime: String(f.mime), size: Number(f.size) || 0, url: fileUrl(String(f.id)) })),
    })),
    contacts: contacts.map((r) => shapeContact(r as Record<string, unknown>)),
    lists: lists.map((r) => ({ id: String(r.id), name: String(r.name), ids: Array.isArray(r.contact_ids) ? (r.contact_ids as string[]) : [], updated: r.updated_at ? new Date(String(r.updated_at)).toISOString() : '' })),
    sends: sends.map((r) => ({ id: String(r.id), list: String(r.list_name || ''), subject: String(r.subject), kind: String(r.kind), total: Number(r.total) || 0, sent: Number(r.sent) || 0, failed: Number(r.failed) || 0, status: String(r.status), at: r.created_at ? new Date(String(r.created_at)).toISOString() : '' })),
    settings: ((set[0]?.data || {}) as Record<string, unknown>),
    testTo: TEST_TO,
  };
}

export async function bwSettings(sql: Sql, ownerId: string, patch: Record<string, unknown>) {
  await ensureBw(sql);
  const clean: Record<string, string> = {};
  if ('address' in patch) clean.address = clip(patch.address, 240);
  if ('fromName' in patch) clean.fromName = clip(patch.fromName, 80);
  const extra: Record<string, unknown> = {};
  if (Array.isArray(patch.stages)) {
    const st = Array.from(new Set((patch.stages as unknown[]).map((x) => clip(x, 40)).filter(Boolean))).slice(0, 15);
    if (st.length) extra.stages = st;
  }
  await sql`INSERT INTO bw_settings (owner_id, ws, data) VALUES (${ownerId}, ${WS}, ${JSON.stringify({ ...clean, ...extra })}::jsonb)
    ON CONFLICT (owner_id, ws) DO UPDATE SET data = bw_settings.data || EXCLUDED.data`;
  return clean;
}

/** Import rows already mapped in the browser. Existing emails are updated (not duplicated); extra columns go to fields. */
export async function bwImport(sql: Sql, ownerId: string, rows: unknown[]) {
  await ensureBw(sql);
  const have = await sql`SELECT id, lower(email) AS e FROM bw_contacts WHERE owner_id = ${ownerId} AND ws = ${WS} AND deleted_at IS NULL AND email <> ''`;
  const byEmail = new Map(have.map((r) => [String(r.e), String(r.id)]));
  let added = 0, updated = 0, skipped = 0;
  for (const raw of (rows || []).slice(0, 5000)) {
    const r = (raw || {}) as Record<string, unknown>;
    const first = clip(r.first, 80), last = clip(r.last, 80), phone = clip(r.phone, 40), company = clip(r.company, 120), city = clip(r.city, 80);
    let email = lc(r.email).slice(0, 200);
    if (email && !EMAIL_RE.test(email)) email = '';
    const fields: Record<string, string> = {};
    const fr = (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>;
    Object.keys(fr).slice(0, 30).forEach((k) => { const key = clip(k, 40); const v = clip(fr[k], 300); if (key && v) fields[key] = v; });
    if (!first && !last && !email && !phone) { skipped++; continue; }
    const hit = email ? byEmail.get(email) : undefined;
    if (hit) {
      await sql`UPDATE bw_contacts SET
        first_name = CASE WHEN ${first} <> '' THEN ${first} ELSE first_name END,
        last_name = CASE WHEN ${last} <> '' THEN ${last} ELSE last_name END,
        phone = CASE WHEN ${phone} <> '' THEN ${phone} ELSE phone END,
        company = CASE WHEN ${company} <> '' THEN ${company} ELSE company END,
        city = CASE WHEN ${city} <> '' THEN ${city} ELSE city END,
        fields = fields || ${JSON.stringify(fields)}::jsonb, updated_at = now()
        WHERE id = ${hit}::uuid AND owner_id = ${ownerId}`;
      updated++;
    } else {
      const ins = await sql`INSERT INTO bw_contacts (owner_id, ws, first_name, last_name, email, phone, company, city, fields)
        VALUES (${ownerId}, ${WS}, ${first}, ${last}, ${email}, ${phone}, ${company}, ${city}, ${JSON.stringify(fields)}::jsonb) RETURNING id`;
      if (email && ins[0]) byEmail.set(email, String(ins[0].id));
      added++;
    }
  }
  return { added, updated, skipped };
}

export async function bwPatchContact(sql: Sql, ownerId: string, id: string, patch: Record<string, unknown>) {
  await ensureBw(sql);
  if ('important' in patch) await sql`UPDATE bw_contacts SET important = ${!!patch.important}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  if ('deleted' in patch) await sql`UPDATE bw_contacts SET deleted_at = ${patch.deleted ? new Date().toISOString() : null}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  if ('resubscribe' in patch && patch.resubscribe) await sql`UPDATE bw_contacts SET unsubscribed_at = NULL, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  if ('notes' in patch) await sql`UPDATE bw_contacts SET notes = ${String(patch.notes ?? '').slice(0, 8000)}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  if ('nextTouch' in patch) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(patch.nextTouch || '')) ? String(patch.nextTouch) : null;
    await sql`UPDATE bw_contacts SET next_touch = ${d}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  }
  if ('stage' in patch) {
    const st = clip(patch.stage, 40);
    const prev = await sql`SELECT stage FROM bw_contacts WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
    await sql`UPDATE bw_contacts SET stage = ${st}, stage_pos = ${Number(patch.stagePos) || 0}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
    if (prev[0] && String(prev[0].stage || '') !== st) await logEvent(sql, ownerId, id, 'stage', st ? `Moved to ${st}` : 'Taken off the pipeline');
  }
  if ('fields' in patch && patch.fields && typeof patch.fields === 'object') {
    const f: Record<string, string> = {};
    Object.keys(patch.fields as Record<string, unknown>).slice(0, 40).forEach((k) => { const key = clip(k, 40); if (key) f[key] = clip((patch.fields as Record<string, unknown>)[k], 300); });
    await sql`UPDATE bw_contacts SET fields = ${JSON.stringify(f)}::jsonb, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  }
  if ('note' in patch && String(patch.note || '').trim()) await logEvent(sql, ownerId, id, 'note', String(patch.note).slice(0, 2000));
  const edit: Record<string, string> = {};
  (['first', 'last', 'email', 'phone', 'company', 'city'] as const).forEach((k) => { if (k in patch) edit[k] = clip(patch[k], k === 'email' ? 200 : 120); });
  if (Object.keys(edit).length) {
    await sql`UPDATE bw_contacts SET
      first_name = COALESCE(${edit.first ?? null}, first_name), last_name = COALESCE(${edit.last ?? null}, last_name),
      email = COALESCE(${edit.email != null ? lc(edit.email) : null}, email), phone = COALESCE(${edit.phone ?? null}, phone),
      company = COALESCE(${edit.company ?? null}, company), city = COALESCE(${edit.city ?? null}, city), updated_at = now()
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
  }
  return true;
}

export async function bwSaveList(sql: Sql, ownerId: string, input: { id?: string; name: string; ids: string[] }) {
  await ensureBw(sql);
  const name = clip(input.name, 80) || 'New list';
  const ids = Array.from(new Set((input.ids || []).map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 20000);
  if (input.id && /^[0-9a-f-]{36}$/i.test(input.id)) {
    await sql`UPDATE bw_lists SET name = ${name}, contact_ids = ${JSON.stringify(ids)}::jsonb, updated_at = now() WHERE id = ${input.id}::uuid AND owner_id = ${ownerId}`;
    return { id: input.id, name, ids };
  }
  const r = await sql`INSERT INTO bw_lists (owner_id, ws, name, contact_ids) VALUES (${ownerId}, ${WS}, ${name}, ${JSON.stringify(ids)}::jsonb) RETURNING id`;
  return { id: String(r[0].id), name, ids };
}

export async function bwDeleteList(sql: Sql, ownerId: string, id: string, restore = false) {
  await ensureBw(sql);
  await sql`UPDATE bw_lists SET deleted_at = ${restore ? null : new Date().toISOString()} WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
}

/* ---------- Email ---------- */
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function secret() { return env('CRON_SECRET') || env('INGEST_TOKEN') || 'bw'; }
export function unsubSig(contactId: string) { return createHmac('sha256', secret()).update('bw-unsub:' + contactId).digest('hex').slice(0, 32); }
export function msgHash(subject: string, body: string) { return createHash('sha256').update(subject + '\u0000' + body).digest('hex').slice(0, 24); }

type C = ReturnType<typeof shapeContact>;
function fill(text: string, c: Partial<C>) {
  return text
    .replace(/\{\s*first name\s*\}/gi, c.first || 'there')
    .replace(/\{\s*last name\s*\}/gi, c.last || '')
    .replace(/\{\s*company\s*\}/gi, c.company || 'your firm')
    .replace(/\{\s*city\s*\}/gi, c.city || '');
}

export function signatureHtml() {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;max-width:560px">
<tr><td style="width:96px;vertical-align:top;padding-right:16px"><img src="${SITE}/assets/email/bruce-photo.png" width="88" height="88" alt="Bruce Fair" style="display:block;border-radius:50%"></td>
<td style="vertical-align:top"><div style="font-size:22px;color:#0d1526;line-height:1.1">Bruce Fair</div>
<div style="font-size:13px;font-weight:bold;letter-spacing:.04em;color:#0b2a6b;margin-top:4px">CAPITAL MARKETS &amp; PARTNER</div>
<div style="font-size:13px;font-weight:bold;letter-spacing:.03em;color:#2E6BF2;margin-top:2px">PEOPLE . TRUST . CLEAR OUTCOMES</div>
<div style="font-size:13px;color:#0d1526;margin-top:8px;border-top:1px solid #0d1526;padding-top:6px;line-height:1.5">M: 604-838-6060<br>E: <a href="mailto:bruce@4ormfinance.com" style="color:#0d1526">bruce@4ormfinance.com</a><br><a href="https://www.4ormfinance.com" style="color:#0d1526">www.4ormfinance.com</a></div></td>
<td style="width:124px;vertical-align:top;padding-left:12px"><img src="${SITE}/assets/email/4orm-finance.png" width="120" alt="4orm Finance" style="display:block"></td></tr>
<tr><td colspan="3" style="font-size:10.5px;line-height:1.45;color:#56607a;padding-top:10px;border-top:1px solid #0d1526"><b style="color:#0b2a6b">CONFIDENTIAL.</b> This email and any attachments are intended solely for the named recipient and may contain confidential or legally privileged information. If you are not the intended recipient, any review, dissemination, distribution, or duplication is strictly prohibited. If you received this message in error, please notify the sender immediately and delete the original and all copies. Nothing in this communication constitutes an offer to sell, or a solicitation of an offer to buy, any securities. Any securities by 4orm Finance Holdings Inc. would be made solely to qualified investors pursuant to available prospectus exemptions under applicable Canadian securities laws, and only by means of definitive offering documentation. 4orm Finance Holdings Inc. and its subsidiaries (4orm Finance Operations Inc., 4ormEX Operations Inc., and 4orm Trust Co.) operate as separately governed Canadian entities.</td></tr></table>`;
}

export function renderEmail(subject: string, body: string, c: Partial<C> & { id?: string }, address: string, test = false, docs: Array<{ name: string; url: string }> | null = null) {
  const text = fill(body, c);
  const subj = fill(subject, c);
  const paras = esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const unsub = c.id ? `${SITE}/api/bw/unsub?c=${c.id}&s=${unsubSig(c.id)}` : `${SITE}/api/bw/unsub`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0d1526;max-width:600px">${test ? '<div style="background:#fff4dc;color:#7a4d00;padding:8px 12px;border-radius:6px;margin-bottom:14px;font-size:13px">TEST. This is what each person on the list will get, with their own name.</div>' : ''}${paras}${docs && docs.length ? `<div style="margin:6px 0 4px;border:1px solid #dfe4ee;border-radius:10px;padding:12px 14px"><div style="font-size:12px;font-weight:bold;letter-spacing:.05em;color:#66718a;margin-bottom:6px">DOCUMENTS</div>${docs.map((d) => `<div style="margin:4px 0"><a href="${esc(d.url)}" style="color:#2E6BF2;font-weight:bold;text-decoration:none">${esc(d.name)}</a></div>`).join('')}</div>` : ''}${signatureHtml()}
<div style="margin-top:16px;font-size:11px;color:#66718a">4orm Finance &middot; ${esc(address || '')} &middot; <a href="${unsub}" style="color:#2E6BF2">Unsubscribe</a></div></div>`;
  const plain = `${text}\n\nBruce Fair\nCapital Markets & Partner, 4orm Finance\nM: 604-838-6060 | bruce@4ormfinance.com | www.4ormfinance.com\n\n4orm Finance · ${address}\nUnsubscribe: ${unsub}`;
  return { subject: subj, html, text: plain };
}

async function listMembers(sql: Sql, ownerId: string, listId: string) {
  const l = await sql`SELECT name, contact_ids FROM bw_lists WHERE id = ${listId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  if (!l[0]) return null;
  const ids = (Array.isArray(l[0].contact_ids) ? l[0].contact_ids : []) as string[];
  const rows = ids.length ? await sql`SELECT * FROM bw_contacts WHERE owner_id = ${ownerId} AND id = ANY(${ids}::uuid[]) AND deleted_at IS NULL` : [];
  const all = rows.map((r) => shapeContact(r as Record<string, unknown>));
  const ok = all.filter((c) => c.email && !c.unsubscribed && !c.bounced);
  return { name: String(l[0].name), all, ok };
}

/** One test to the test inbox, filled with the first person on the list. Records the message hash so the real send is allowed. */
export async function bwTest(sql: Sql, ownerId: string, input: { listId: string; subject: string; body: string; spaceId?: string }) {
  await ensureBw(sql);
  const subject = clip(input.subject, 200), body = String(input.body || '').slice(0, 20000);
  if (!subject || !body.trim()) return { ok: false, note: 'Write a subject and a message first.' };
  const set = await sql`SELECT data FROM bw_settings WHERE owner_id = ${ownerId} AND ws = ${WS}`;
  const address = String(((set[0]?.data || {}) as Record<string, unknown>).address || '');
  const m = input.listId ? await listMembers(sql, ownerId, input.listId) : null;
  const sample = (m && m.ok[0]) || { first: 'Margaret', last: 'Chen', company: 'Harbour Capital', city: 'Vancouver' };
  const docs = await spaceBlock(sql, ownerId, input.spaceId || null);
  const mail = renderEmail(subject, body, sample, address || '[mailing address]', true, docs);
  const contactId = await ensureGhlContact({ name: 'Chad Johnston', email: TEST_TO });
  if (!contactId) return { ok: false, note: 'GoHighLevel did not answer. Try again.' };
  const ok = await sendViaGhl({ contactId, email: TEST_TO, subject: '[TEST] ' + mail.subject, html: mail.html, text: mail.text, emailFrom: 'bruce@4ormfinance.com' });
  const hash = msgHash(subject, body + '|' + (input.spaceId || ''));
  if (ok) await sql`INSERT INTO bw_sends (owner_id, ws, list_id, list_name, subject, body, hash, kind, total, status)
    VALUES (${ownerId}, ${WS}, ${input.listId && /^[0-9a-f-]{36}$/i.test(input.listId) ? input.listId : null}, ${m?.name || ''}, ${subject}, ${body}, ${hash}, 'test', 1, 'sent')`;
  return { ok, to: TEST_TO, hash, note: ok ? '' : 'GoHighLevel did not send the test.' };
}

/** Queue the real send. Refused unless a test of this exact subject and message went out in the last 24 hours, and a mailing address is set. */
export async function bwQueue(sql: Sql, ownerId: string, input: { listId: string; subject: string; body: string; spaceId?: string }) {
  await ensureBw(sql);
  const subject = clip(input.subject, 200), body = String(input.body || '').slice(0, 20000);
  const hash = msgHash(subject, body + '|' + (input.spaceId || ''));
  const spaceId = input.spaceId && /^[0-9a-f-]{36}$/i.test(input.spaceId) ? input.spaceId : null;
  const set = await sql`SELECT data FROM bw_settings WHERE owner_id = ${ownerId} AND ws = ${WS}`;
  if (!String(((set[0]?.data || {}) as Record<string, unknown>).address || '').trim()) return { ok: false, note: 'Add your mailing address first. The law needs it on every group email.' };
  const tested = await sql`SELECT 1 FROM bw_sends WHERE owner_id = ${ownerId} AND ws = ${WS} AND kind = 'test' AND hash = ${hash} AND created_at > now() - interval '24 hours' LIMIT 1`;
  if (!tested[0]) return { ok: false, note: 'Send yourself a test of this exact email first.' };
  const m = await listMembers(sql, ownerId, input.listId);
  if (!m) return { ok: false, note: 'Pick a list.' };
  if (!m.ok.length) return { ok: false, note: 'Nobody on this list can be emailed.' };
  const s = await sql`INSERT INTO bw_sends (owner_id, ws, list_id, list_name, subject, body, hash, kind, total, status, space_id)
    VALUES (${ownerId}, ${WS}, ${input.listId}::uuid, ${m.name}, ${subject}, ${body}, ${hash}, 'send', ${m.ok.length}, 'queued', ${spaceId}) RETURNING id`;
  const sendId = String(s[0].id);
  for (const c of m.ok) await sql`INSERT INTO bw_queue (send_id, owner_id, contact_id) VALUES (${sendId}::uuid, ${ownerId}, ${c.id}::uuid)`;
  return { ok: true, id: sendId, total: m.ok.length, left: m.all.length - m.ok.length };
}

export async function bwCancel(sql: Sql, ownerId: string, sendId: string) {
  await ensureBw(sql);
  await sql`UPDATE bw_sends SET status = 'cancelled', cancelled_at = now() WHERE id = ${sendId}::uuid AND owner_id = ${ownerId} AND status IN ('queued','sending')`;
  await sql`UPDATE bw_queue SET status = 'cancelled' WHERE send_id = ${sendId}::uuid AND owner_id = ${ownerId} AND status = 'queued'`;
}

/** Cron: send the next batch. Each row is claimed atomically so nothing goes twice. */
export async function bwProcess(sql: Sql, ownerId: string, deadline = Date.now() + 40000) {
  await ensureBw(sql);
  const claimed = await sql`
    UPDATE bw_queue SET status = 'sending', claimed_at = now()
    WHERE id IN (
      SELECT q.id FROM bw_queue q JOIN bw_sends s ON s.id = q.send_id
      WHERE q.owner_id = ${ownerId} AND q.status = 'queued' AND s.status IN ('queued','sending') AND s.created_at < now() - interval '60 seconds'
      ORDER BY s.created_at, q.id LIMIT ${BATCH} FOR UPDATE SKIP LOCKED
    ) RETURNING id, send_id, contact_id`;
  let sent = 0, failed = 0;
  const sendCache = new Map<string, { subject: string; body: string; docs: Array<{ name: string; url: string }> | null }>();
  const set = await sql`SELECT data FROM bw_settings WHERE owner_id = ${ownerId} AND ws = ${WS}`;
  const address = String(((set[0]?.data || {}) as Record<string, unknown>).address || '');
  for (const q of claimed) {
    if (Date.now() > deadline) { await sql`UPDATE bw_queue SET status = 'queued', claimed_at = NULL WHERE id = ${q.id}`; continue; }
    const sid = String(q.send_id);
    try {
      if (!sendCache.has(sid)) {
        const s = await sql`SELECT subject, body, space_id FROM bw_sends WHERE id = ${sid}::uuid`;
        const docs = await spaceBlock(sql, ownerId, s[0]?.space_id ? String(s[0].space_id) : null);
        sendCache.set(sid, { subject: String(s[0]?.subject || ''), body: String(s[0]?.body || ''), docs });
        await sql`UPDATE bw_sends SET status = 'sending' WHERE id = ${sid}::uuid AND status = 'queued'`;
      }
      const msg = sendCache.get(sid)!;
      const cr = await sql`SELECT * FROM bw_contacts WHERE id = ${q.contact_id} AND owner_id = ${ownerId}`;
      const c = cr[0] ? shapeContact(cr[0] as Record<string, unknown>) : null;
      if (!c || !c.email || c.unsubscribed || c.bounced) { await sql`UPDATE bw_queue SET status = 'skipped', detail = 'not emailable' WHERE id = ${q.id}`; continue; }
      const mail = renderEmail(msg.subject, msg.body, c, address, false, msg.docs);
      const gid = await ensureGhlContact({ name: `${c.first} ${c.last}`.trim() || c.email, email: c.email, company: c.company });
      const ok = gid ? await sendViaGhl({ contactId: gid, email: c.email, subject: mail.subject, html: mail.html, text: mail.text, emailFrom: 'bruce@4ormfinance.com' }) : false;
      if (ok) {
        sent++;
        await sql`UPDATE bw_queue SET status = 'sent', sent_at = now() WHERE id = ${q.id}`;
        await sql`UPDATE bw_contacts SET last_emailed_at = now() WHERE id = ${c.id}::uuid`;
        await logEvent(sql, ownerId, c.id, 'email', `Group email: ${mail.subject}`);
      } else {
        failed++;
        await sql`UPDATE bw_queue SET status = 'failed', detail = 'GoHighLevel refused' WHERE id = ${q.id}`;
      }
    } catch (err) {
      failed++;
      fail('bw_send', err);
      await sql`UPDATE bw_queue SET status = 'failed', detail = 'error' WHERE id = ${q.id}`;
    }
  }
  await sql`UPDATE bw_sends s SET status = 'done' WHERE s.owner_id = ${ownerId} AND s.status = 'sending'
    AND NOT EXISTS (SELECT 1 FROM bw_queue q WHERE q.send_id = s.id AND q.status IN ('queued','sending'))`;
  return { sent, failed, claimed: claimed.length };
}

export async function bwUnsubscribe(sql: Sql, contactId: string, sig: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contactId) || !tokenOk(String(sig || ''), unsubSig(contactId))) return false;
  await ensureBw(sql);
  await sql`UPDATE bw_contacts SET unsubscribed_at = COALESCE(unsubscribed_at, now()), updated_at = now() WHERE id = ${contactId}::uuid`;
  await sql`UPDATE bw_queue SET status = 'skipped', detail = 'unsubscribed' WHERE contact_id = ${contactId}::uuid AND status = 'queued'`;
  return true;
}


export async function logEvent(sql: Sql, ownerId: string, contactId: string, kind: string, text: string) {
  try { await sql`INSERT INTO bw_events (owner_id, contact_id, kind, text) VALUES (${ownerId}, ${contactId}::uuid, ${kind}, ${text.slice(0, 2000)})`; } catch (err) { fail('bw_event', err); }
}

export async function bwHistory(sql: Sql, ownerId: string, contactId: string) {
  await ensureBw(sql);
  const rows = await sql`SELECT kind, text, at FROM bw_events WHERE owner_id = ${ownerId} AND contact_id = ${contactId}::uuid ORDER BY at DESC LIMIT 100`;
  return rows.map((r) => ({ kind: String(r.kind), text: String(r.text), at: new Date(String(r.at)).toISOString() }));
}

export async function bwAddContact(sql: Sql, ownerId: string, input: Record<string, unknown>) {
  const r = await bwImport(sql, ownerId, [input]);
  const email = lc(input.email);
  const row = email
    ? await sql`SELECT id FROM bw_contacts WHERE owner_id = ${ownerId} AND ws = ${WS} AND lower(email) = ${email} AND deleted_at IS NULL LIMIT 1`
    : await sql`SELECT id FROM bw_contacts WHERE owner_id = ${ownerId} AND ws = ${WS} AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  return { ...r, id: row[0] ? String(row[0].id) : '' };
}

/* ---------- Spaces: packs of documents and links Bruce attaches to email ---------- */
export function fileSig(id: string) { return createHmac('sha256', secret()).update('bw-file:' + id).digest('hex').slice(0, 32); }
export function fileUrl(id: string) { return `${SITE}/api/bw/file?f=${id}&s=${fileSig(id)}`; }

export async function bwSaveSpace(sql: Sql, ownerId: string, input: Record<string, unknown>) {
  await ensureBw(sql);
  const name = clip(input.name, 100) || 'New space';
  const note = String(input.note ?? '').slice(0, 8000);
  const grp = clip(input.group, 40) || 'General';
  const links = Array.isArray(input.links) ? (input.links as Array<Record<string, unknown>>).slice(0, 30).map((l) => ({ name: clip(l.name, 120) || clip(l.url, 120), url: clip(l.url, 600) })).filter((l) => /^https?:\/\//i.test(l.url)) : null;
  const id = String(input.id || '');
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    await sql`UPDATE bw_spaces SET name = ${name}, note = ${note}, grp = ${grp}, links = COALESCE(${links ? JSON.stringify(links) : null}::jsonb, links), updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
    return { id };
  }
  const r = await sql`INSERT INTO bw_spaces (owner_id, ws, name, note, grp, links) VALUES (${ownerId}, ${WS}, ${name}, ${note}, ${grp}, ${JSON.stringify(links || [])}::jsonb) RETURNING id`;
  return { id: String(r[0].id) };
}

export async function bwDeleteSpace(sql: Sql, ownerId: string, id: string, restore = false) {
  await ensureBw(sql);
  await sql`UPDATE bw_spaces SET deleted_at = ${restore ? null : new Date().toISOString()} WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
}

export async function bwAddFile(sql: Sql, ownerId: string, input: { spaceId: string; name: string; mime: string; b64: string }) {
  await ensureBw(sql);
  const buf = Buffer.from(String(input.b64 || ''), 'base64');
  if (!buf.length) return { ok: false, note: 'That file is empty.' };
  if (buf.length > 3_000_000) return { ok: false, note: 'Files up to 3 MB. For bigger files, add a link instead.' };
  const sp = await sql`SELECT 1 FROM bw_spaces WHERE id = ${input.spaceId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  if (!sp[0]) return { ok: false, note: 'That space is gone.' };
  const name = clip(input.name, 160) || 'File';
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(String(input.mime || '')) ? String(input.mime) : 'application/octet-stream';
  const r = await sql`INSERT INTO bw_files (owner_id, space_id, name, mime, size, data) VALUES (${ownerId}, ${input.spaceId}::uuid, ${name}, ${mime}, ${buf.length}, ${'\\x' + buf.toString('hex')}::bytea) RETURNING id`;
  await sql`UPDATE bw_spaces SET updated_at = now() WHERE id = ${input.spaceId}::uuid`;
  return { ok: true, id: String(r[0].id) };
}

export async function bwDeleteFile(sql: Sql, ownerId: string, id: string, restore = false) {
  await ensureBw(sql);
  await sql`UPDATE bw_files SET deleted_at = ${restore ? null : new Date().toISOString()} WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
}

export async function bwReadFile(sql: Sql, id: string, sig: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !tokenOk(String(sig || ''), fileSig(id))) return null;
  await ensureBw(sql);
  const r = await sql`SELECT name, mime, encode(data, 'base64') AS b64 FROM bw_files WHERE id = ${id}::uuid AND deleted_at IS NULL`;
  if (!r[0]) return null;
  return { name: String(r[0].name), mime: String(r[0].mime), buf: Buffer.from(String(r[0].b64), 'base64') };
}

async function spaceBlock(sql: Sql, ownerId: string, spaceId: string | null) {
  if (!spaceId || !/^[0-9a-f-]{36}$/i.test(spaceId)) return null;
  const sp = await sql`SELECT name, links FROM bw_spaces WHERE id = ${spaceId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  if (!sp[0]) return null;
  const files = await sql`SELECT id, name FROM bw_files WHERE space_id = ${spaceId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY created_at`;
  const items = files.map((f) => ({ name: String(f.name), url: fileUrl(String(f.id)) }))
    .concat((Array.isArray(sp[0].links) ? (sp[0].links as Array<{ name: string; url: string }>) : []));
  return items.length ? items : null;
}
