import type { NeonQueryFunction } from '@neondatabase/serverless';
import sheet from '../data/outreach-lists.json';
import { withCreds } from './creds';
import { getContact, listPipelines, moveOpportunityStage, type GhlPipeline } from './ghl';
import { fail } from './log';
import { loadCredsFor } from './vault';

type Sql = NeonQueryFunction<false, false>;

export type ReachListPerson = {
  id: string;
  listKey: string;
  name: string;
  role: string;
  company: string;
  companySub: string;
  phone: string;
  email: string;
  stage: string;
  lastTouch: string;
  day: string;
  done: boolean;
  spaceId: string;
  opportunityId: string;
  contactId: string;
  ready: number[];
  nextStep: string;
  rank: number;
};

export type ReachList = {
  id: string;
  key: string;
  name: string;
  sub: string;
  kind: string;
  count: number;
  done: number;
  people: ReachListPerson[];
};

const DAYS_FALLBACK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function vancouverParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { weekday: get('weekday'), day: get('day'), month: get('month') };
}

/** e.g. "Wed 28 Oct" in America/Vancouver. */
export function vancouverDayLabel(d = new Date()) {
  const p = vancouverParts(d);
  return `${p.weekday} ${p.day} ${p.month}`;
}

function weekdayBuckets(n: number) {
  const today = new Date();
  const labels: string[] = [];
  let i = 0;
  while (labels.length < 5) {
    const d = new Date(today.getTime() + i * 86400000);
    const p = vancouverParts(d);
    if (p.weekday !== 'Sat' && p.weekday !== 'Sun') {
      labels.push(`${p.weekday} ${p.day} ${p.month}`);
    }
    i += 1;
    if (i > 14) break;
  }
  while (labels.length < 5) labels.push(DAYS_FALLBACK[labels.length] || 'Mon');
  return Array.from({ length: n }, (_, ix) => labels[Math.floor(ix / 5) % labels.length]);
}

function fact(row: { facts?: string[][] }, key: string) {
  const hit = (row.facts || []).find((f) => f[0] === key);
  return hit ? String(hit[1] || '') : '';
}

function clip(v: unknown, max: number) {
  return String(v ?? '').trim().slice(0, max);
}

function nextFromReady(ready: number[], stage: string) {
  const labels = ['Add documents', 'Add links', 'Add people', 'Write notes', 'Write the angle', 'Ready for email'];
  const miss = ready.findIndex((n) => !n);
  if (miss >= 0) {
    const verb = ['Attach', 'Paste', 'Add', 'Write', 'Write', 'Move to email'][miss] || 'Build';
    return `${verb} · ${labels[miss]}`;
  }
  if (/cold|new|open/i.test(stage)) return 'Call, ask for 20 min';
  if (/reach|send/i.test(stage)) return 'Wait · follow up';
  return 'Move to email · ready';
}

function sheetPeople(kind: 'inv' | 'ent', slice: { start: number; end: number }, listKey: string): ReachListPerson[] {
  const rows = (kind === 'inv' ? sheet.inv : sheet.ent) as Array<Record<string, unknown>>;
  const days = weekdayBuckets(Math.max(0, slice.end - slice.start));
  return rows.slice(slice.start, slice.end).map((row, ix) => {
    const ready = [1, 1, 0, 0, 0, 0];
    const stage = String(row.st || 'Cold');
    const phone = fact(row as { facts?: string[][] }, 'Phone') || '';
    const email = String(row.em || '');
    return {
      id: `${listKey}:${String(row.id || ix)}`,
      listKey,
      name: String(row.p || row.n || 'Contact').split(',')[0].trim() || String(row.n || 'Contact'),
      role: String(row.p || '').includes(',') ? String(row.p).split(',').slice(1).join(',').trim() : (kind === 'inv' ? 'Investor' : 'Contact'),
      company: String(row.n || ''),
      companySub: [
        fact(row as { facts?: string[][] }, 'Base') || fact(row as { facts?: string[][] }, 'Segment'),
        fact(row as { facts?: string[][] }, 'First cheque') || fact(row as { facts?: string[][] }, 'Scale'),
      ].filter(Boolean).join(' · '),
      phone,
      email,
      stage,
      lastTouch: 'Never',
      day: days[ix] || '',
      done: false,
      spaceId: '',
      opportunityId: '',
      contactId: '',
      ready,
      nextStep: nextFromReady(ready, stage),
      rank: Number(row.rank) || ix + 1,
    };
  });
}

async function designPartnerPeople(ownerId: string, pipes: GhlPipeline[]): Promise<ReachListPerson[]> {
  const pipe = pipes.find((p) => /design\s*partner/i.test(p.name))
    || pipes.find((p) => /partner/i.test(p.name) && !/dev/i.test(p.name));
  if (!pipe) return [];
  type Flat = { opp: (typeof pipe.stages)[0]['opps'][0]; stageName: string; stageIx: number };
  const flat: Flat[] = [];
  pipe.stages.forEach((stage, stageIx) => {
    for (const opp of stage.opps) flat.push({ opp, stageName: stage.name, stageIx });
  });
  flat.sort((a, b) => {
    if (a.stageIx !== b.stageIx) return a.stageIx - b.stageIx;
    return String(b.opp.updatedAt || '').localeCompare(String(a.opp.updatedAt || ''));
  });
  const top = flat.slice(0, 50);
  const days = weekdayBuckets(top.length);
  const people: ReachListPerson[] = [];
  for (let i = 0; i < top.length; i++) {
    const { opp, stageName } = top[i];
    let phone = '';
    let email = opp.email || '';
    let role = '';
    if (opp.contactId) {
      const c = await getContact(opp.contactId).catch(() => null);
      if (c) {
        phone = c.phone || phone;
        email = c.email || email;
        role = c.role || role;
      }
    }
    const ready = [1, Number(!!email), Number(!!opp.contactId), 0, 0, 0];
    const last = opp.updatedAt
      ? new Date(opp.updatedAt).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short' })
      : 'Never';
    people.push({
      id: `dp:${opp.id || i}`,
      listKey: 'design-partners',
      name: opp.contact || opp.name || 'Contact',
      role: role || 'Design partner',
      company: opp.company || opp.name || '',
      companySub: stageName,
      phone,
      email,
      stage: stageName,
      lastTouch: last,
      day: days[i] || '',
      done: /won|closed|sent|contacted|replied|meeting/i.test(stageName),
      spaceId: '',
      opportunityId: opp.id,
      contactId: opp.contactId,
      ready,
      nextStep: nextFromReady(ready, stageName),
      rank: i + 1,
    });
  }
  return people;
}

async function regulatorPeople(sql: Sql, ownerId: string): Promise<ReachListPerson[]> {
  try {
    const rows = await sql`
      SELECT id, name, stage, notes, kind, category, ghl_opportunity_id, updated_at, created_at
      FROM spaces
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        AND (category ILIKE 'Regulatory' OR kind = 'regulator')
      ORDER BY COALESCE(position, 0), created_at
      LIMIT 15
    `;
    const ids = rows.map((r) => String(r.id));
    const recipients = ids.length
      ? await sql`
          SELECT space_id, name, email, role
          FROM space_recipients
          WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND space_id = ANY(${ids}::uuid[])
          ORDER BY created_at
        `.catch(() => [])
      : [];
    const bySpace = new Map<string, Array<{ name: string; email: string; role: string }>>();
    for (const r of recipients as Array<Record<string, unknown>>) {
      const sid = String(r.space_id || '');
      const list = bySpace.get(sid) || [];
      list.push({ name: String(r.name || ''), email: String(r.email || ''), role: String(r.role || '') });
      bySpace.set(sid, list);
    }
    const metaItems = ids.length
      ? await sql`
          SELECT space_id, kind, mime FROM space_items
          WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND space_id = ANY(${ids}::uuid[])
        `.catch(() => [])
      : [];
    const counts = new Map<string, { docs: number; links: number }>();
    for (const row of metaItems as Array<Record<string, unknown>>) {
      const sid = String(row.space_id || '');
      const c = counts.get(sid) || { docs: 0, links: 0 };
      if (String(row.mime || '') === 'text/x-folder') continue;
      c.docs += 1;
      if (String(row.kind || '') === 'link') c.links += 1;
      counts.set(sid, c);
    }
    const angles = ids.length
      ? await sql`
          SELECT id, to_jsonb(spaces) ->> 'angle' AS angle FROM spaces WHERE id = ANY(${ids}::uuid[])
        `.catch(() => [])
      : [];
    const angleBy = new Map(angles.map((r: Record<string, unknown>) => [String(r.id), String(r.angle || '')]));
    const mail = ids.length
      ? await sql`SELECT space_id, subject, body FROM space_email WHERE space_id = ANY(${ids}::uuid[])`.catch(() => [])
      : [];
    const mailBy = new Map(mail.map((r: Record<string, unknown>) => [String(r.space_id), r]));
    const days = weekdayBuckets(rows.length);
    return (rows as Array<Record<string, unknown>>).map((row, ix) => {
      const sid = String(row.id);
      const people = bySpace.get(sid) || [];
      const first = people[0];
      const c = counts.get(sid) || { docs: 0, links: 0 };
      const hasAngle = !!angleBy.get(sid);
      const hasMail = !!(mailBy.get(sid) && (String((mailBy.get(sid) as { subject?: string }).subject || '') || String((mailBy.get(sid) as { body?: string }).body || '')));
      const ready = [
        Number(c.docs > 0),
        Number(c.links > 0),
        Number(people.length > 0),
        Number(!!String(row.notes || '').trim()),
        Number(hasAngle),
        Number(hasMail),
      ];
      const stage = String(row.stage || 'Cold');
      return {
        id: `reg:${sid}`,
        listKey: 'regulators',
        name: first?.name || String(row.name || 'Regulator'),
        role: first?.role || 'Regulator',
        company: String(row.name || ''),
        companySub: 'Regulatory',
        phone: '',
        email: first?.email || '',
        stage,
        lastTouch: row.updated_at
          ? new Date(String(row.updated_at)).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short' })
          : 'Never',
        day: days[ix] || '',
        done: /sent|contacted|replied/i.test(stage) || !!row.ghl_opportunity_id && /sent/i.test(stage),
        spaceId: sid,
        opportunityId: String(row.ghl_opportunity_id || ''),
        contactId: '',
        ready,
        nextStep: nextFromReady(ready, stage),
        rank: ix + 1,
      };
    });
  } catch (err) {
    fail('reach_regulators', err);
    return [];
  }
}

async function applyDoneMarks(sql: Sql, ownerId: string, people: ReachListPerson[]) {
  try {
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = await sql`
        SELECT id, list_key, contact_id, ghl_opportunity_id, space_id, done
        FROM reach_out
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ` as Array<Record<string, unknown>>;
    } catch {
      rows = await sql`
        SELECT id, contact_id, done FROM reach_out WHERE owner_id = ${ownerId}
      ` as Array<Record<string, unknown>>;
    }
    const byKey = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      byKey.set(String(r.id), r);
      if (r.ghl_opportunity_id) byKey.set(`dp:${r.ghl_opportunity_id}`, r);
      if (r.space_id) byKey.set(`reg:${r.space_id}`, r);
      if (r.list_key && r.contact_id) byKey.set(`${r.list_key}:${r.contact_id}`, r);
      if (r.contact_id) byKey.set(String(r.contact_id), r);
    }
    for (const p of people) {
      const hit = byKey.get(p.id) || (p.contactId ? byKey.get(p.contactId) : null);
      if (hit && hit.done) p.done = true;
    }
  } catch (err) {
    fail('reach_done_marks', err);
  }
}

export async function buildCallLists(sql: Sql, ownerId: string, userId: string): Promise<ReachList[]> {
  let pipes: GhlPipeline[] = [];
  try {
    const creds = await loadCredsFor(userId);
    const all = await withCreds(creds, () => listPipelines());
    pipes = all.pipelines || [];
  } catch (err) {
    fail('reach_pipes', err);
  }

  const [design, regulators] = await Promise.all([
    designPartnerPeople(ownerId, pipes),
    regulatorPeople(sql, ownerId),
  ]);
  const preseed = sheetPeople('inv', { start: 0, end: 25 }, 'pre-seed');
  const entProtected = sheetPeople('ent', { start: 0, end: 25 }, 'ent-1-25');
  const entWeek = sheetPeople('ent', { start: 25, end: 50 }, 'ent-26-50');

  // Attach matching spaces by company / name so a row click opens the space.
  try {
    const spaces = await sql`
      SELECT id, name FROM spaces WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    const byName = new Map(
      (spaces as Array<{ id: string; name: string }>).map((s) => [String(s.name || '').trim().toLowerCase(), String(s.id)]),
    );
    for (const p of [...design, ...preseed, ...entProtected, ...entWeek]) {
      if (p.spaceId) continue;
      const hit = byName.get(p.company.trim().toLowerCase()) || byName.get(p.name.trim().toLowerCase());
      if (hit) p.spaceId = hit;
    }
  } catch (err) {
    fail('reach_space_match', err);
  }

  const allPeople = [...design, ...preseed, ...regulators, ...entProtected, ...entWeek];
  await applyDoneMarks(sql, ownerId, allPeople);

  // Custom lists (soft-deleted excluded)
  let custom: ReachList[] = [];
  try {
    const lists = await sql`
      SELECT id, name, kind, source
      FROM contact_lists
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        AND name NOT ILIKE 'Pre-seed%'
        AND name NOT ILIKE 'Enterprise BC%'
        AND name NOT ILIKE 'Design partners%'
        AND name NOT ILIKE 'Regulators%'
      ORDER BY created_at
    `;
    for (const list of lists as Array<Record<string, unknown>>) {
      const rows = await sql`
        SELECT r.contact_id, r.position, r.day, r.sent_at, r.stage, r.phone, r.email,
          c.name, c.company, c.email AS c_email, c.phone AS c_phone, c.role
        FROM contact_list_rows r
        LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId} AND c.deleted_at IS NULL
        WHERE r.list_id = ${String(list.id)}::uuid
        ORDER BY r.position
      `.catch(() => []);
      const people = (rows as Array<Record<string, unknown>>).map((r, ix) => {
        const ready = [0, 0, 0, 0, 0, 0];
        const stage = String(r.stage || 'Cold');
        return {
          id: `custom:${list.id}:${r.contact_id || ix}`,
          listKey: `custom:${list.id}`,
          name: String(r.name || 'Person'),
          role: String(r.role || ''),
          company: String(r.company || ''),
          companySub: '',
          phone: String(r.phone || r.c_phone || ''),
          email: String(r.email || r.c_email || ''),
          stage,
          lastTouch: r.sent_at ? 'Sent' : 'Never',
          day: String(r.day || ''),
          done: !!r.sent_at,
          spaceId: '',
          opportunityId: '',
          contactId: String(r.contact_id || ''),
          ready,
          nextStep: nextFromReady(ready, stage),
          rank: Number(r.position) || ix + 1,
        } as ReachListPerson;
      });
      custom.push({
        id: String(list.id),
        key: `custom:${list.id}`,
        name: String(list.name),
        sub: `${people.length} people`,
        kind: 'custom',
        count: people.length,
        done: people.filter((p) => p.done).length,
        people,
      });
    }
  } catch (err) {
    fail('reach_custom_lists', err);
  }

  const wrap = (key: string, name: string, sub: string, kind: string, people: ReachListPerson[]): ReachList => ({
    id: key,
    key,
    name,
    sub,
    kind,
    count: people.length,
    done: people.filter((p) => p.done).length,
    people,
  });

  return [
    wrap('design-partners', 'Design partners', `${design.length} people · 5 a day`, 'design', design),
    wrap('pre-seed', 'Pre-seed investors', '25 funds · 5 a day', 'vc', preseed),
    wrap('regulators', 'Regulators', '15 Regulatory spaces', 'regulator', regulators),
    wrap('ent-1-25', 'Enterprise BC · #1-25', '25 · protected', 'enterprise', entProtected),
    wrap('ent-26-50', 'Enterprise BC · #26-50', '25 · 5 a day', 'enterprise', entWeek),
    ...custom,
  ];
}

/** Flatten for War Room / legacy GET { people }. */
export function flattenPeople(lists: ReachList[]) {
  return lists.flatMap((list) => list.people.map((p) => ({
    id: p.id,
    contactId: p.contactId,
    name: p.name,
    company: p.company,
    kind: list.kind === 'design' ? 'design' : list.kind === 'regulator' ? 'regulator' : list.kind === 'vc' ? 'vc' : 'corporate',
    nextAction: p.nextStep,
    done: p.done,
    phone: p.phone,
    email: p.email,
    spaceId: p.spaceId,
    opportunityId: p.opportunityId,
    listKey: p.listKey,
    stage: p.stage,
    day: p.day,
  })));
}

export async function tickReachPerson(
  sql: Sql,
  ownerId: string,
  userId: string,
  id: string,
  done: boolean,
  sessionEmail: string,
) {
  const lists = await buildCallLists(sql, ownerId, userId);
  const person = lists.flatMap((l) => l.people).find((p) => p.id === id);
  if (!person) return null;

  const testOnly = /opstest@4ormfinance\.com/i.test(sessionEmail);
  const canWriteGhl = !testOnly || /TEST/i.test(person.name) || /opstest/i.test(person.email);

  try {
    const existing = await sql`
      SELECT id FROM reach_out
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        AND (
          id::text = ${id}
          OR (ghl_opportunity_id IS NOT NULL AND ghl_opportunity_id = ${person.opportunityId || '__'})
          OR (space_id IS NOT NULL AND space_id = ${person.spaceId || '__'})
          OR (list_key = ${person.listKey} AND contact_id = ${person.contactId || id})
        )
      LIMIT 1
    `;
    if (existing[0]?.id) {
      await sql`
        UPDATE reach_out SET
          done = ${done},
          stage = ${done ? 'Contacted' : person.stage},
          next_action = ${person.nextStep}
        WHERE id = ${String(existing[0].id)}::uuid AND owner_id = ${ownerId}
      `;
    } else {
      await sql`
        INSERT INTO reach_out (owner_id, contact_id, name, company, kind, next_action, done, phone, email, space_id, ghl_opportunity_id, list_key, day, stage, role)
        VALUES (
          ${ownerId}, ${person.contactId || id}, ${clip(person.name, 120)}, ${clip(person.company, 160)},
          ${person.listKey === 'design-partners' ? 'design' : person.listKey === 'regulators' ? 'regulator' : person.listKey === 'pre-seed' ? 'vc' : 'corporate'},
          ${clip(person.nextStep, 180)}, ${done}, ${clip(person.phone, 40) || null}, ${clip(person.email, 180) || null},
          ${person.spaceId || null}, ${person.opportunityId || null}, ${person.listKey}, ${person.day || null},
          ${done ? 'Contacted' : person.stage}, ${clip(person.role, 120) || null}
        )
      `;
    }
  } catch (err) {
    fail('reach_tick_upsert', err);
  }

  let ghl = { ok: false as boolean, note: '' };
  if (done && person.opportunityId && canWriteGhl) {
    try {
      const creds = await loadCredsFor(userId);
      const moved = await withCreds(creds, () => moveOpportunityStage({
        opportunityId: person.opportunityId,
        stage: 'Contacted',
      }));
      if (!moved.ok) {
        const alt = await withCreds(creds, () => moveOpportunityStage({
          opportunityId: person.opportunityId,
          stage: 'Reached Out',
        }));
        ghl = alt.ok ? { ok: true, note: '' } : { ok: false, note: alt.note };
      } else {
        ghl = { ok: true, note: '' };
      }
    } catch (err) {
      fail('reach_tick_ghl', err);
      ghl = { ok: false, note: 'GoHighLevel did not take that stage' };
    }
  } else if (done && testOnly && !canWriteGhl) {
    ghl = { ok: false, note: 'Test mode: GoHighLevel writes only for opstest / TEST rows' };
  }

  return { ...person, done, ghl };
}

export async function softDeleteList(sql: Sql, ownerId: string, listId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
  const rows = await sql`
    UPDATE contact_lists SET deleted_at = now()
    WHERE id = ${listId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
    RETURNING id, name
  `;
  return rows[0] ? { id: String(rows[0].id), name: String(rows[0].name) } : null;
}

export async function restoreList(sql: Sql, ownerId: string, listId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(listId)) return null;
  const rows = await sql`
    UPDATE contact_lists SET deleted_at = NULL
    WHERE id = ${listId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NOT NULL
    RETURNING id, name
  `;
  return rows[0] ? { id: String(rows[0].id), name: String(rows[0].name) } : null;
}

export async function createList(sql: Sql, ownerId: string, name: string) {
  const clean = clip(name, 80) || 'New list';
  const rows = await sql`
    INSERT INTO contact_lists (owner_id, name, kind, source, columns)
    VALUES (${ownerId}, ${clean}, 'manual', 'hand', ${JSON.stringify(['#', 'Name', 'Company', 'Phone', 'Email', 'Day'])}::jsonb)
    RETURNING id, name
  `;
  return { id: String(rows[0].id), name: String(rows[0].name) };
}
