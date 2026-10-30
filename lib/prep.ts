import type { NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Email Prep (30 Oct 2026): outreach lined up one card per person or firm, ready for Chad to send.
 * Nothing here sends anything. A card holds the route (email, LinkedIn, form, phone), the draft,
 * the two best ways in, the reason to write and the proposed send day and time. Chad sends from
 * compose, LinkedIn or the phone, then marks it done. Contact data is loaded from the signed-in
 * session, never from the repo.
 */
type Sql = NeonQueryFunction<false, false>;

let ready = false;
export async function ensurePrep(sql: Sql) {
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS prep_items (
    id text NOT NULL,
    owner_id text NOT NULL,
    cat text NOT NULL DEFAULT 'other',
    day text,
    slot text,
    channel text NOT NULL DEFAULT 'email',
    name text NOT NULL DEFAULT '',
    org text NOT NULL DEFAULT '',
    title text NOT NULL DEFAULT '',
    to_email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    linkedin text NOT NULL DEFAULT '',
    url text NOT NULL DEFAULT '',
    subject text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    routes jsonb NOT NULL DEFAULT '[]'::jsonb,
    hook text NOT NULL DEFAULT '',
    hook_url text NOT NULL DEFAULT '',
    watch text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'ready',
    sort int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    done_at timestamptz,
    deleted_at timestamptz,
    PRIMARY KEY (owner_id, id)
  )`;
  await sql`ALTER TABLE prep_items ADD COLUMN IF NOT EXISTS followup text NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE prep_items ADD COLUMN IF NOT EXISTS growth_id text NOT NULL DEFAULT ''`;
  ready = true;
}

const STATUS = new Set(['ready', 'done', 'skipped', 'waiting']);
const CHANNEL = new Set(['email', 'linkedin', 'form', 'phone', 'task', 'intro']);
const s = (v: unknown, n = 4000) => String(v == null ? '' : v).slice(0, n);

export async function prepList(sql: Sql, ownerId: string) {
  await ensurePrep(sql);
  const rows = await sql`SELECT id, cat, day, slot, channel, name, org, title, to_email, phone, linkedin, url, subject, body, note, followup,
      routes, hook, hook_url, watch, status, sort, growth_id, updated_at, done_at
    FROM prep_items WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY cat, sort, name`;
  return rows;
}

export async function prepUpsert(sql: Sql, ownerId: string, items: unknown[]) {
  await ensurePrep(sql);
  let n = 0;
  for (const raw of items.slice(0, 400)) {
    const r = (raw || {}) as Record<string, unknown>;
    const id = s(r.id, 80).replace(/[^a-z0-9_-]/gi, '');
    if (!id) continue;
    const channel = CHANNEL.has(String(r.channel)) ? String(r.channel) : 'email';
    const routes = Array.isArray(r.routes) ? r.routes.slice(0, 4) : [];
    await sql`INSERT INTO prep_items (id, owner_id, cat, day, slot, channel, name, org, title, to_email, phone, linkedin, url, subject, body, note, followup, routes, hook, hook_url, watch, sort, growth_id)
      VALUES (${id}, ${ownerId}, ${s(r.cat, 40)}, ${s(r.day, 10) || null}, ${s(r.slot, 20) || null}, ${channel}, ${s(r.name, 200)}, ${s(r.org, 200)}, ${s(r.title, 200)},
        ${s(r.to_email, 200)}, ${s(r.phone, 60)}, ${s(r.linkedin, 300)}, ${s(r.url, 500)}, ${s(r.subject, 300)}, ${s(r.body, 6000)}, ${s(r.note, 2000)}, ${s(r.followup, 4000)},
        ${JSON.stringify(routes)}::jsonb, ${s(r.hook, 1000)}, ${s(r.hook_url, 500)}, ${s(r.watch, 500)}, ${Number(r.sort) | 0}, ${s(r.growth_id, 40)})
      ON CONFLICT (owner_id, id) DO UPDATE SET cat = EXCLUDED.cat, day = EXCLUDED.day, slot = EXCLUDED.slot, channel = EXCLUDED.channel, name = EXCLUDED.name,
        org = EXCLUDED.org, title = EXCLUDED.title, to_email = EXCLUDED.to_email, phone = EXCLUDED.phone, linkedin = EXCLUDED.linkedin, url = EXCLUDED.url,
        subject = EXCLUDED.subject, body = EXCLUDED.body, note = EXCLUDED.note, followup = EXCLUDED.followup, routes = EXCLUDED.routes, hook = EXCLUDED.hook,
        hook_url = EXCLUDED.hook_url, watch = EXCLUDED.watch, sort = EXCLUDED.sort, growth_id = EXCLUDED.growth_id, deleted_at = NULL, updated_at = now()
      WHERE prep_items.status = 'ready'`;
    n += 1;
  }
  return { n };
}

export async function prepPatch(sql: Sql, ownerId: string, id: string, p: Record<string, unknown>) {
  await ensurePrep(sql);
  if ('status' in p) {
    const st = String(p.status);
    if (!STATUS.has(st)) throw new Error('bad status');
    await sql`UPDATE prep_items SET status = ${st}, done_at = ${st === 'done' ? new Date().toISOString() : null}, updated_at = now() WHERE owner_id = ${ownerId} AND id = ${id}`;
  }
  if ('subject' in p || 'body' in p || 'note' in p) {
    await sql`UPDATE prep_items SET subject = COALESCE(${'subject' in p ? s(p.subject, 300) : null}, subject),
        body = COALESCE(${'body' in p ? s(p.body, 6000) : null}, body), note = COALESCE(${'note' in p ? s(p.note, 2000) : null}, note), updated_at = now()
      WHERE owner_id = ${ownerId} AND id = ${id}`;
  }
  if ('day' in p) await sql`UPDATE prep_items SET day = ${s(p.day, 10) || null}, slot = ${s(p.slot, 20) || null}, updated_at = now() WHERE owner_id = ${ownerId} AND id = ${id}`;
  if ('deleted' in p) await sql`UPDATE prep_items SET deleted_at = ${p.deleted ? new Date().toISOString() : null} WHERE owner_id = ${ownerId} AND id = ${id}`;
}
