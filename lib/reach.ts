import type { NeonQueryFunction } from '@neondatabase/serverless';
import { withCreds } from './creds';
import { moveOpportunityStage } from './ghl';
import { fail } from './log';
import {
  buildCallLists,
  createList,
  flattenPeople,
  personNotes,
  restoreList,
  softDeleteList,
  tickReachPerson,
  uploadList,
  type ReachList,
  type UploadRow,
} from './reach-lists';
import { loadCredsFor } from './vault';

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
  phone?: string;
  email?: string;
  spaceId?: string;
  opportunityId?: string;
  listKey?: string;
  stage?: string;
  day?: string;
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
    phone: row.phone ? String(row.phone) : '',
    email: row.email ? String(row.email) : '',
    spaceId: row.space_id ? String(row.space_id) : '',
    opportunityId: row.ghl_opportunity_id ? String(row.ghl_opportunity_id) : '',
    listKey: row.list_key ? String(row.list_key) : '',
    stage: row.stage ? String(row.stage) : '',
    day: row.day ? String(row.day) : '',
  };
}

export async function listReach(sql: Sql, ownerId: string, userId?: string) {
  try {
    const lists = await buildCallLists(sql, ownerId, userId || ownerId);
    return flattenPeople(lists);
  } catch (err) {
    fail('reach_list', err);
    try {
      const rows = await sql`
        SELECT id, contact_id, name, company, kind, next_action, done, phone, email, space_id, ghl_opportunity_id, list_key, day, stage
        FROM reach_out
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        ORDER BY done, created_at DESC
      `;
      return (rows as Record<string, unknown>[]).map(shape);
    } catch (inner) {
      fail('reach_list_fallback', inner);
      return [];
    }
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

export async function patchReach(
  sql: Sql,
  ownerId: string,
  id: string,
  input: Record<string, unknown>,
  opts?: { userId?: string; email?: string },
) {
  const setDone = Object.prototype.hasOwnProperty.call(input, 'done');
  if (setDone && (id.includes(':') || opts?.userId)) {
    const tick = await tickReachPerson(
      sql,
      ownerId,
      opts?.userId || ownerId,
      id,
      !!input.done,
      opts?.email || '',
    );
    if (tick) {
      return {
        id: tick.id,
        contactId: tick.contactId,
        name: tick.name,
        company: tick.company,
        kind: kindOf(tick.listKey === 'design-partners' ? 'design' : tick.listKey === 'regulators' ? 'regulator' : 'corporate'),
        nextAction: tick.nextStep,
        done: tick.done,
        phone: tick.phone,
        email: tick.email,
        spaceId: tick.spaceId,
        opportunityId: tick.opportunityId,
        listKey: tick.listKey,
        stage: tick.done ? 'Contacted' : tick.stage,
        day: tick.day,
        ghl: tick.ghl,
      };
    }
  }
  const setStage = Object.prototype.hasOwnProperty.call(input, 'stage');
  const setCallback = Object.prototype.hasOwnProperty.call(input, 'callback');
  const stageVal = clip(input.stage, 80);
  const callbackVal = clip(input.callback, 80);
  /* Composite list row ids (listKey:n) and GHL-backed rows go through tick + stage upsert. */
  if ((setStage || setCallback) && (id.includes(':') || opts?.userId)) {
    try {
      const tick = await tickReachPerson(
        sql,
        ownerId,
        opts?.userId || ownerId,
        id,
        setStage && /contacted|emailed|meeting|package|book/i.test(stageVal) && !/^reach out$/i.test(stageVal),
        opts?.email || '',
      );
      if (tick) {
        if (setStage) {
          await sql`
            UPDATE reach_out SET stage = ${stageVal || 'Reach out'},
              next_action = CASE WHEN ${setCallback} THEN ${callbackVal ? 'Call back ' + callbackVal : tick.nextStep} ELSE next_action END
            WHERE owner_id = ${ownerId} AND deleted_at IS NULL
              AND (
                id::text = ${id}
                OR (ghl_opportunity_id IS NOT NULL AND ghl_opportunity_id = ${tick.opportunityId || '__'})
                OR (list_key = ${tick.listKey} AND contact_id = ${tick.contactId || id})
              )
          `;
          if (tick.opportunityId && stageVal) {
            try {
              const creds = await loadCredsFor(opts?.userId || ownerId);
              await withCreds(creds, () => moveOpportunityStage({
                opportunityId: tick.opportunityId,
                stage: stageVal,
              }));
            } catch (err) {
              fail('reach_stage_ghl', err);
            }
          }
        } else if (setCallback) {
          await sql`
            UPDATE reach_out SET next_action = ${callbackVal ? 'Call back ' + callbackVal : tick.nextStep}
            WHERE owner_id = ${ownerId} AND deleted_at IS NULL
              AND (
                id::text = ${id}
                OR (list_key = ${tick.listKey} AND contact_id = ${tick.contactId || id})
              )
          `;
        }
        return {
          id: tick.id,
          contactId: tick.contactId,
          name: tick.name,
          company: tick.company,
          kind: kindOf(tick.listKey === 'design-partners' ? 'design' : tick.listKey === 'regulators' ? 'regulator' : 'corporate'),
          nextAction: callbackVal ? 'Call back ' + callbackVal : tick.nextStep,
          done: tick.done,
          phone: tick.phone,
          email: tick.email,
          spaceId: tick.spaceId,
          opportunityId: tick.opportunityId,
          listKey: tick.listKey,
          stage: stageVal || tick.stage,
          day: tick.day,
          callback: callbackVal || '',
          ghl: tick.ghl,
        };
      }
    } catch (err) {
      fail('reach_stage_patch', err);
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const setAction = Object.prototype.hasOwnProperty.call(input, 'nextAction') || Object.prototype.hasOwnProperty.call(input, 'next_action');
  const setKind = Object.prototype.hasOwnProperty.call(input, 'kind');
  const setArchived = Object.prototype.hasOwnProperty.call(input, 'archived') || Object.prototype.hasOwnProperty.call(input, 'deleted');
  const done = !!input.done;
  const nextAction = clip(input.nextAction || input.next_action, 180);
  const kind = kindOf(input.kind);
  const archived = !!(input.archived ?? input.deleted);
  try {
    if (setArchived) {
      const rows = await sql`
        UPDATE reach_out SET deleted_at = CASE WHEN ${archived} THEN now() ELSE NULL END
        WHERE id = ${id} AND owner_id = ${ownerId}
        RETURNING id, contact_id, name, company, kind, next_action, done, phone, email, space_id, ghl_opportunity_id, list_key, day, stage
      `;
      return rows[0] ? shape(rows[0] as Record<string, unknown>) : null;
    }
    const rows = await sql`
      UPDATE reach_out SET
        done = CASE WHEN ${setDone} THEN ${done} ELSE done END,
        next_action = CASE
          WHEN ${setCallback} THEN ${callbackVal ? 'Call back ' + callbackVal : nextAction}
          WHEN ${setAction} THEN ${nextAction}
          ELSE next_action
        END,
        kind = CASE WHEN ${setKind} THEN ${kind} ELSE kind END,
        stage = CASE WHEN ${setStage} THEN ${stageVal || 'Reach out'} ELSE stage END
      WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
      RETURNING id, contact_id, name, company, kind, next_action, done, phone, email, space_id, ghl_opportunity_id, list_key, day, stage
    `;
    return rows[0] ? shape(rows[0] as Record<string, unknown>) : null;
  } catch (err) {
    fail('reach_patch', err);
    return null;
  }
}

export { createList, softDeleteList, restoreList, uploadList, personNotes };
export type { UploadRow };
