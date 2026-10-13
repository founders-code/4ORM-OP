import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

const KINDS = ['corporate', 'vc', 'client', 'design', 'regulator'];

export type ReachPerson = {
  id: string;
  contactId: string;
  name: string;
  company: string;
  kind: string;
  nextAction: string;
  done: boolean;
};

function clip(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function kindOf(value: unknown) {
  const key = clip(value, 20).toLowerCase();
  return KINDS.includes(key) ? key : 'corporate';
}

function shape(row: Record<string, unknown>): ReachPerson {
  return {
    id: String(row.id),
    contactId: row.contact_id ? String(row.contact_id) : '',
    name: String(row.name || ''),
    company: String(row.company || ''),
    kind: kindOf(row.kind),
    nextAction: String(row.next_action || ''),
    done: !!row.done,
  };
}

export async function listReach(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`
      SELECT id, contact_id, name, company, kind, next_action, done
      FROM reach_out
      WHERE owner_id = ${ownerId}
      ORDER BY done, created_at DESC
    `;
    return (rows as Record<string, unknown>[]).map(shape);
  } catch (err) {
    fail('reach_list', err);
    return [];
  }
}

export async function addReach(sql: Sql, ownerId: string, input: Record<string, unknown>) {
  const name = clip(input.name, 120) || 'Person';
  const company = clip(input.company, 160);
  const kind = kindOf(input.kind);
  const nextAction = clip(input.nextAction || input.next_action, 180) || 'Reach out';
  const contactId = clip(input.contactId || input.contact_id, 40);
  try {
    const rows = await sql`
      INSERT INTO reach_out (owner_id, contact_id, name, company, kind, next_action)
      VALUES (${ownerId}, ${contactId || null}, ${name}, ${company}, ${kind}, ${nextAction})
      RETURNING id, contact_id, name, company, kind, next_action, done
    `;
    return shape(rows[0] as Record<string, unknown>);
  } catch (err) {
    fail('reach_add', err);
    return null;
  }
}

export async function patchReach(sql: Sql, ownerId: string, id: string, input: Record<string, unknown>) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const setDone = Object.prototype.hasOwnProperty.call(input, 'done');
  const setAction = Object.prototype.hasOwnProperty.call(input, 'nextAction') || Object.prototype.hasOwnProperty.call(input, 'next_action');
  const setKind = Object.prototype.hasOwnProperty.call(input, 'kind');
  const done = !!input.done;
  const nextAction = clip(input.nextAction || input.next_action, 180);
  const kind = kindOf(input.kind);
  try {
    const rows = await sql`
      UPDATE reach_out SET
        done = CASE WHEN ${setDone} THEN ${done} ELSE done END,
        next_action = CASE WHEN ${setAction} THEN ${nextAction} ELSE next_action END,
        kind = CASE WHEN ${setKind} THEN ${kind} ELSE kind END
      WHERE id = ${id} AND owner_id = ${ownerId}
      RETURNING id, contact_id, name, company, kind, next_action, done
    `;
    return rows[0] ? shape(rows[0] as Record<string, unknown>) : null;
  } catch (err) {
    fail('reach_patch', err);
    return null;
  }
}
