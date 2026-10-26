import type { NeonQueryFunction } from '@neondatabase/serverless';
import { findGhlContactId, ghlConfigured, setGhlContactTags } from './ghl';

type Sql = NeonQueryFunction<false, false>;

const EMAIL = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/** Tag words as the box stores them: lower case, no '#', letters / digits / - / _ only, max 40. */
export function cleanTags(value: unknown) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/);
  const out: string[] = [];
  for (const raw of list) {
    const tag = String(raw || '').trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 20);
}

export function cleanEmails(value: unknown) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[,;\s]+/);
  const out: string[] = [];
  for (const raw of list) {
    const e = String(raw || '').trim().toLowerCase();
    if (EMAIL.test(e) && !out.includes(e)) out.push(e);
  }
  return out.slice(0, 10);
}

/** Additive: Contacts gets a tags column (text[]). */
export async function ensureContactTags(sql: Sql) {
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags text[]`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
}

export type TagPushResult = { email: string; contacts: number; ghl: 'tagged' | 'no_contact' | 'failed' | 'not_connected' };

/**
 * B56: a tag added to (or removed from) a box goes to every address in the box:
 * the local Contacts rows with that email, and the GoHighLevel contact with that email (found, never created).
 */
export async function pushBoxTags(sql: Sql, ownerId: string, emails: string[], add: string[], remove: string[]) {
  await ensureContactTags(sql);
  const ghlOn = ghlConfigured();
  const results: TagPushResult[] = [];
  for (const email of emails) {
    let contacts = 0;
    if (add.length) {
      const rows = await sql`
        UPDATE contacts SET tags = ARRAY(SELECT DISTINCT t FROM unnest(COALESCE(tags, '{}'::text[]) || ${add}::text[]) AS t ORDER BY t)
        WHERE owner_id = ${ownerId} AND lower(email) = ${email} AND deleted_at IS NULL
        RETURNING id
      `;
      contacts = Math.max(contacts, rows.length);
    }
    if (remove.length) {
      const rows = await sql`
        UPDATE contacts SET tags = ARRAY(SELECT t FROM unnest(COALESCE(tags, '{}'::text[])) AS t WHERE NOT (t = ANY(${remove}::text[])))
        WHERE owner_id = ${ownerId} AND lower(email) = ${email} AND deleted_at IS NULL
        RETURNING id
      `;
      contacts = Math.max(contacts, rows.length);
    }
    let ghl: TagPushResult['ghl'] = 'not_connected';
    if (ghlOn) {
      const id = await findGhlContactId(email);
      if (!id) ghl = 'no_contact';
      else {
        const okAdd = add.length ? await setGhlContactTags(id, add, 'add') : true;
        const okRemove = remove.length ? await setGhlContactTags(id, remove, 'remove') : true;
        ghl = okAdd && okRemove ? 'tagged' : 'failed';
      }
    }
    results.push({ email, contacts, ghl });
  }
  return results;
}
