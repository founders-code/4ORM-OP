import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

let starReady: Promise<boolean> | null = null;

/** Additive, idempotent: contacts.starred (Contacts page "Star"). Safe to run on every cold start. */
export function ensureContactStar(sql: Sql) {
  if (!starReady) {
    starReady = (async () => {
      try {
        await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false`;
        return true;
      } catch (err) {
        fail('contacts_star_column', err);
        starReady = null;
        return false;
      }
    })();
  }
  return starReady;
}

/** Ids of live starred contacts for this owner. */
export async function starredContactIds(sql: Sql, ownerId: string) {
  if (!(await ensureContactStar(sql))) return [] as string[];
  const rows = await sql`SELECT id FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND starred = true`;
  return (rows as Array<{ id: string }>).map((row) => String(row.id));
}

export async function setContactStar(sql: Sql, ownerId: string, id: string, on: boolean) {
  if (!(await ensureContactStar(sql))) return null;
  const rows = await sql`
    UPDATE contacts SET starred = ${on}
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
    RETURNING id, starred
  `;
  return rows.length ? { id: String((rows[0] as { id: string }).id), starred: !!(rows[0] as { starred: boolean }).starred } : null;
}

export type ContactSpaceLink = { contactId: string; email: string; spaceId: string; spaceName: string };

/**
 * Which Space each person sits in as a recipient: matched by space_recipients.contact_id, or by the
 * recipient's email (case-insensitive). Never by name text. Soft-deleted spaces and recipients are skipped.
 */
export async function contactSpaceLinks(sql: Sql, ownerId: string): Promise<ContactSpaceLink[]> {
  try {
    const rows = await sql`
      SELECT coalesce(r.contact_id::text, '') AS contact_id, lower(trim(coalesce(r.email, ''))) AS email,
             s.id::text AS space_id, s.name AS space_name
      FROM space_recipients r
      JOIN spaces s ON s.id = r.space_id AND s.owner_id = ${ownerId} AND s.deleted_at IS NULL
      WHERE r.owner_id = ${ownerId} AND r.deleted_at IS NULL
        AND (r.contact_id IS NOT NULL OR coalesce(trim(r.email), '') <> '')
      ORDER BY s.created_at DESC
      LIMIT 2000
    `;
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      contactId: String(row.contact_id || ''),
      email: String(row.email || ''),
      spaceId: String(row.space_id || ''),
      spaceName: String(row.space_name || 'Space'),
    }));
  } catch (err) {
    fail('contacts_space_links', err);
    return [];
  }
}
