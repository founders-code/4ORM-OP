import type { NeonQueryFunction } from '@neondatabase/serverless';
import sheet from '../data/outreach-lists.json';
import fills from '../data/contact-fills.json';
import { withCreds } from './creds';
import { getContact, listPipelines, moveOpportunityStage, type GhlPipeline } from './ghl';
import { fail } from './log';
import { addTouch, GROWTH_VIEWS, listGrowth } from './growth';
import { loadCredsFor } from './vault';

type Sql = NeonQueryFunction<false, false>;

export type ReachListPerson = {
  id: string;
  listKey: string;
  name: string;
  role: string;
  company: string;
  companySub: string;
  city: string;
  phone: string;
  email: string;
  notes: string;
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
  ghlStage?: string;
  ghlPipeline?: string;
  growth?: boolean;
  pain?: number | null;
  industry?: string;
  location?: string;
  why?: string;
  fitLine?: string;
  backed?: string;
  painLine?: string;
  inContacts?: boolean;
  starred?: boolean;
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
  /** Uploaded lists: the CSV file the list came from. */
  file?: string;
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
    const city = fact(row as { facts?: string[][] }, 'Base') || fact(row as { facts?: string[][] }, 'Segment') || '';
    const notes = clip(row.why || row.watch || '', 400);
    return {
      id: `${listKey}:${String(row.id || ix)}`,
      listKey,
      name: String(row.p || row.n || 'Contact').split(',')[0].trim() || String(row.n || 'Contact'),
      role: String(row.p || '').includes(',') ? String(row.p).split(',').slice(1).join(',').trim() : (kind === 'inv' ? 'Investor' : 'Contact'),
      company: String(row.n || ''),
      companySub: [
        city,
        fact(row as { facts?: string[][] }, 'First cheque') || fact(row as { facts?: string[][] }, 'Scale'),
      ].filter(Boolean).join(' · '),
      city,
      phone,
      email,
      notes,
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
  /* Contact lookups in parallel batches (was 50 one after another, about 6 seconds). */
  const contacts = new Map<string, Awaited<ReturnType<typeof getContact>>>();
  const ids = Array.from(new Set(top.map((t) => t.opp.contactId).filter(Boolean))) as string[];
  for (let b = 0; b < ids.length; b += 10) {
    const chunk = ids.slice(b, b + 10);
    const got = await Promise.all(chunk.map((id) => getContact(id).catch(() => null)));
    chunk.forEach((id, k) => contacts.set(id, got[k]));
  }
  for (let i = 0; i < top.length; i++) {
    const { opp, stageName } = top[i];
    let phone = '';
    let email = opp.email || '';
    let role = '';
    if (opp.contactId) {
      const c = contacts.get(opp.contactId) || null;
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
      city: '',
      phone,
      email,
      notes: '',
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
        city: '',
        phone: '',
        email: first?.email || '',
        notes: clip(row.notes, 400),
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
  let creds: Awaited<ReturnType<typeof loadCredsFor>> | null = null;
  /* Once the growth lists are loaded the older GoHighLevel-built lists are not shown, so skip the
     pipeline pull and the per-contact lookups that went with it (dozens of calls on every page load). */
  const hasGrowth = await sql`SELECT 1 FROM growth_records WHERE owner_id = ${ownerId} AND deleted_at IS NULL LIMIT 1`.then((r) => r.length > 0).catch(() => false);
  if (!hasGrowth) {
    try {
      creds = await loadCredsFor(userId);
      const all = await withCreds(creds, () => listPipelines());
      pipes = all.pipelines || [];
    } catch (err) {
      fail('reach_pipes', err);
    }
  }

  const [designLive, regulators] = await Promise.all([
    hasGrowth ? Promise.resolve([] as ReachListPerson[]) : creds ? withCreds(creds, () => designPartnerPeople(ownerId, pipes)).catch(() => [] as ReachListPerson[]) : designPartnerPeople(ownerId, pipes),
    regulatorPeople(sql, ownerId),
  ]);
  /* GoHighLevel can time out or rate-limit. Keep the last good Design partners list so the page never flips to empty. */
  const design = await keepLastGood(sql, ownerId, 'design-partners', designLive);
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
      SELECT id, name, kind, source, created_at
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
          r.name AS row_name, r.company AS row_company, r.notes AS row_notes,
          c.name, c.company, c.email AS c_email, c.phone AS c_phone, c.role, c.notes AS c_notes, c.area
        FROM contact_list_rows r
        LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId} AND c.deleted_at IS NULL
        WHERE r.list_id = ${String(list.id)}::uuid
        ORDER BY r.position
      `.catch(() => []);
      const people = (rows as Array<Record<string, unknown>>).map((r, ix) => {
        const ready = [0, 0, 0, 0, 0, 0];
        const stage = String(r.stage || 'Cold');
        const city = clip(r.area, 80);
        return {
          id: `custom:${list.id}:${r.contact_id || ix}`,
          listKey: `custom:${list.id}`,
          name: String(r.name || r.row_name || 'Person'),
          role: String(r.role || ''),
          company: String(r.company || r.row_company || ''),
          companySub: city,
          city,
          phone: String(r.phone || r.c_phone || ''),
          email: String(r.email || r.c_email || ''),
          notes: clip(r.row_notes || r.c_notes, 400),
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
      const src = String(list.source || '');
      const file = src.startsWith('csv:') ? src.slice(4) : '';
      let when = '';
      try { when = list.created_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short' }).format(new Date(String(list.created_at))) : ''; } catch { when = ''; }
      custom.push({
        id: String(list.id),
        key: `custom:${list.id}`,
        name: String(list.name),
        file: file || (when ? `CSV uploaded ${when}` : 'CSV upload'),
        sub: `${people.length} people · uploaded`,
        kind: 'uploaded',
        count: people.length,
        done: people.filter((p) => p.done).length,
        people,
      });
    }
  } catch (err) {
    fail('reach_custom_lists', err);
  }

  /* Growth lists: the ranked BC master (design partners, angels, firms, new funds, regulators...). */
  const growth: ReachList[] = [];
  try {
    const rows = await listGrowth(sql, ownerId, null);
    const dayLabel = (d: unknown) => {
      if (!d) return '';
      const iso = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
        .format(new Date(`${iso}T12:00:00Z`)).replace(',', '');
    };
    for (const v of GROWTH_VIEWS) {
      const mine = v.pick(rows);
      if (!mine.length) continue;
      const people = mine.map((r, ix) => {
        const isPerson = r.list === 'angels';
        let firstContact = String(r.contact || '').split(/\s*[|;]\s*/)[0] || '';
        if (/^(existing contact|leadership|executive|business contact|principal broker)/i.test(firstContact)) firstContact = '';
        const ready = [0, 0, 0, 0, 0, 0];
        const stage = String(r.stage || 'Cold');
        return {
          id: `${v.key}:${r.id}`,
          listKey: v.key,
          name: isPerson ? String(r.name || firstContact) : (firstContact && !/@|^\+?\d/.test(firstContact) ? firstContact : String(r.name || '')),
          role: String(r.title || ''),
          company: isPerson ? '' : String(r.name || ''),
          companySub: [String(r.city || ''), String(r.prov || ''), String(r.type || '')].filter(Boolean).join(' · '),
          city: String(r.city || ''),
          phone: String(r.phone || ''),
          email: String(r.email || ''),
          notes: clip(r.notes || r.next_action, 400),
          stage,
          lastTouch: r.last_touch ? new Date(String(r.last_touch)).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short' }) : 'Never',
          day: dayLabel(r.plan_day),
          done: !!r.last_touch,
          spaceId: '',
          opportunityId: '',
          contactId: String(r.id),
          ready,
          nextStep: String(r.next_action || '') || nextFromReady(ready, stage),
          rank: ix + 1,
          ghlStage: String(r.ghl_stage || ''),
          ghlPipeline: String(r.ghl_pipeline || ''),
          growth: true,
          pain: r.pain === null || r.pain === undefined || r.pain === '' ? null : Number(r.pain),
          industry: String(r.industry || r.type || ''),
          location: String(r.location || [r.city, r.prov].filter(Boolean).join(', ') || ''),
          why: clip(String(r.iwhy || r.next_action || '').split(/;\s*|\.\s+/).map((x) => x.trim()).filter((x) => x && !/\b\d+\s*\/\s*\d+\b/.test(x) && !/unknown fields|limited poi/i.test(x)).join('; '), 220),
          fitLine: Array.isArray(r.ifit) ? (r.ifit as string[]).slice(0, 2).join(' · ') : '',
          backed: String(r.ibacked || ''),
          painLine: String(r.ipain || '').replace(/^Drivers:\s*/, ''),
          inContacts: !!r.in_contact,
          starred: !!r.starred_at,
        } as ReachListPerson;
      });
      growth.push({
        id: v.key, key: v.key, name: v.name, sub: `${people.length} · ${v.sub}`,
        kind: v.master ? 'master' : v.kind, count: people.length, done: people.filter((p) => p.done).length, people,
      });
    }
  } catch (err) {
    fail('reach_growth_lists', err);
  }

  const everyone = [...allPeople, ...custom.flatMap((l) => l.people)];
  fillPublicContacts(everyone);
  await applyDoneMarks(sql, ownerId, everyone);

  // Fill notes / city from contacts matched by email when the list row is thin.
  try {
    const emails = everyone.map((p) => p.email.toLowerCase()).filter((e) => e.includes('@'));
    if (emails.length) {
      const unique = Array.from(new Set(emails)).slice(0, 400);
      const rows = await sql`
        SELECT id, name, email, phone, notes, area, company, last_touch
        FROM contacts
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND lower(email) = ANY(${unique}::text[])
      `.catch(() => []);
      const byEmail = new Map(
        (rows as Array<Record<string, unknown>>).map((r) => [String(r.email || '').toLowerCase(), r]),
      );
      for (const p of everyone) {
        const hit = byEmail.get(p.email.toLowerCase());
        if (!hit) continue;
        if (!p.contactId) p.contactId = String(hit.id || '');
        if (!p.notes) p.notes = clip(hit.notes, 400);
        if (!p.city) p.city = clip(hit.area, 80);
        if (!p.phone) p.phone = clip(hit.phone, 40);
        if (p.lastTouch === 'Never' && hit.last_touch) {
          p.lastTouch = new Date(String(hit.last_touch)).toLocaleDateString('en-CA', {
            timeZone: 'America/Vancouver', day: 'numeric', month: 'short',
          });
        }
        if (p.city && p.companySub && !p.companySub.includes(p.city)) {
          p.companySub = `${p.companySub} · ${p.city}`;
        } else if (p.city && !p.companySub) {
          p.companySub = p.city;
        }
      }
    }
  } catch (err) {
    fail('reach_contact_enrich', err);
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

  /* Once the growth lists are loaded they replace the four older lists (every contact is in the masters). */
  if (growth.length) return [...growth.filter((l) => l.kind !== 'master'), ...custom, ...growth.filter((l) => l.kind === 'master')];
  return [
    wrap('design-partners', 'Design partners', `${design.length} people · 5 a day`, 'design', design),
    wrap('pre-seed', 'VCs, pre-seed', '25 funds · 5 a day', 'vc', preseed),
    wrap('regulators', 'Regulators', `${regulators.length || 15} bodies`, 'regulator', regulators),
    wrap('ent-1-25', 'Enterprise BC #1-50', '50 · protected 1-25', 'enterprise', [...entProtected, ...entWeek].slice(0, 50)),
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

  if (/^(w|m)-/.test(person.listKey)) {
    try {
      if (done) await addTouch(sql, ownerId, person.contactId, { channel: 'Ticked', outcome: 'Contacted', note: 'Ticked off in Lists' });
      else await sql`UPDATE growth_records SET last_touch = NULL, status = 'Not contacted' WHERE owner_id = ${ownerId} AND id = ${person.contactId}`;
    } catch (err) {
      fail('reach_tick_growth', err);
    }
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

export type UploadRow = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
  city?: string;
};

/** Create a list from mapped CSV rows; match existing contacts by email. */
export async function uploadList(sql: Sql, ownerId: string, name: string, rows: UploadRow[], fileName = '') {
  const clean = clip(name, 80) || 'Uploaded list';
  const source = fileName ? `csv:${clip(fileName, 160)}` : 'csv';
  const list = await sql`
    INSERT INTO contact_lists (owner_id, name, kind, source, columns)
    VALUES (
      ${ownerId}, ${clean}, 'uploaded', ${source},
      ${JSON.stringify(['Name', 'Company', 'Phone', 'Email', 'Notes'])}::jsonb
    )
    RETURNING id, name
  `;
  const listId = String(list[0].id);
  const days = weekdayBuckets(Math.max(rows.length, 1));
  let matched = 0;
  let created = 0;
  for (let i = 0; i < rows.slice(0, 500).length; i++) {
    const row = rows[i];
    const email = clip(row.email, 180).toLowerCase();
    const personName = clip(row.name, 120) || email.split('@')[0] || 'Person';
    const company = clip(row.company, 160);
    const phone = clip(row.phone, 40);
    const notes = clip(row.notes, 2000);
    const city = clip(row.city, 80);
    let contactId = '';
    if (email.includes('@')) {
      const found = await sql`
        SELECT id FROM contacts
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND lower(email) = ${email}
        LIMIT 1
      `.catch(() => []);
      if (found[0]?.id) {
        contactId = String(found[0].id);
        matched += 1;
        if (notes) {
          await sql`
            UPDATE contacts SET
              notes = CASE WHEN coalesce(notes, '') = '' THEN ${notes} ELSE notes END,
              phone = CASE WHEN coalesce(phone, '') = '' THEN ${phone || null} ELSE phone END,
              area = CASE WHEN coalesce(area, '') = '' THEN ${city || null} ELSE area END
            WHERE id = ${contactId}::uuid AND owner_id = ${ownerId}
          `.catch(() => null);
        }
      }
    }
    if (!contactId) {
      const inserted = await sql`
        INSERT INTO contacts (owner_id, name, company, email, phone, area, notes, source, type, stage)
        VALUES (
          ${ownerId}, ${personName}, ${company || null}, ${email || null}, ${phone || null},
          ${city || null}, ${notes || null}, 'csv-upload', 'other', 'new'
        )
        RETURNING id
      `.catch(() => []);
      if (inserted[0]?.id) {
        contactId = String(inserted[0].id);
        created += 1;
      } else {
        contactId = `row-${i}-${Date.now()}`;
      }
    }
    await sql`
      INSERT INTO contact_list_rows (list_id, contact_id, position, day, stage, phone, email, name, company, notes)
      VALUES (
        ${listId}::uuid, ${contactId}, ${i + 1}, ${days[i] || null}, 'Cold',
        ${phone || null}, ${email || null}, ${personName}, ${company || null}, ${notes || null}
      )
      ON CONFLICT (list_id, contact_id) DO UPDATE SET
        position = EXCLUDED.position, phone = EXCLUDED.phone, email = EXCLUDED.email,
        name = EXCLUDED.name, company = EXCLUDED.company, notes = EXCLUDED.notes
    `.catch((err) => { fail('reach_upload_row', err); });
  }
  return {
    id: listId,
    name: String(list[0].name),
    key: `custom:${listId}`,
    count: rows.length,
    matched,
    created,
  };
}

export type PersonNote = {
  source: string;
  when: string;
  text: string;
};

/** Full notes newest first: Contacts + person space + Zoom notes. */
export async function personNotes(
  sql: Sql,
  ownerId: string,
  userId: string,
  personId: string,
): Promise<{ notes: PersonNote[]; person: ReachListPerson | null }> {
  const lists = await buildCallLists(sql, ownerId, userId);
  const person = lists.flatMap((l) => l.people).find((p) => p.id === personId) || null;
  const notes: PersonNote[] = [];
  const push = (source: string, when: string | Date | null | undefined, text: string) => {
    const t = String(text || '').trim();
    if (!t) return;
    const whenLabel = when
      ? new Date(when).toLocaleString('en-CA', {
        timeZone: 'America/Vancouver',
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      : '';
    notes.push({ source, when: whenLabel, text: t });
  };

  if (person?.contactId && /^[0-9a-f-]{36}$/i.test(person.contactId)) {
    try {
      const rows = await sql`
        SELECT notes, updated_at, created_at FROM contacts
        WHERE id = ${person.contactId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (rows[0]) push('Contacts', rows[0].updated_at || rows[0].created_at, String(rows[0].notes || ''));
    } catch (err) {
      fail('reach_notes_contact', err);
    }
  } else if (person?.email) {
    try {
      const rows = await sql`
        SELECT notes, updated_at, created_at FROM contacts
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND lower(email) = ${person.email.toLowerCase()}
        LIMIT 1
      `;
      if (rows[0]) push('Contacts', rows[0].updated_at || rows[0].created_at, String(rows[0].notes || ''));
    } catch (err) {
      fail('reach_notes_contact_email', err);
    }
  }

  if (person?.spaceId) {
    try {
      const rows = await sql`
        SELECT notes, updated_at, created_at FROM spaces
        WHERE id = ${person.spaceId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (rows[0]) push('Space', rows[0].updated_at || rows[0].created_at, String(rows[0].notes || ''));
      const items = await sql`
        SELECT body, created_at FROM space_items
        WHERE space_id = ${person.spaceId}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL AND kind = 'note'
        ORDER BY created_at DESC
        LIMIT 20
      `.catch(() => []);
      for (const it of items as Array<Record<string, unknown>>) {
        push('Space note', it.created_at as string | Date | null | undefined, String(it.body || ''));
      }
    } catch (err) {
      fail('reach_notes_space', err);
    }
  }

  const nameNeedle = (person?.name || '').trim().toLowerCase();
  const emailNeedle = (person?.email || '').trim().toLowerCase();
  if (nameNeedle || emailNeedle) {
    try {
      const rows = await sql`
        SELECT title, ai_summary, others, note_date, created_at, attendees
        FROM zoom_notes
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        ORDER BY coalesce(note_date, created_at::date) DESC
        LIMIT 40
      `.catch(() => []);
      for (const z of rows as Array<Record<string, unknown>>) {
        const attendees = Array.isArray(z.attendees)
          ? (z.attendees as unknown[]).map((a) => String(a).toLowerCase())
          : [];
        const blob = `${z.title || ''} ${attendees.join(' ')}`.toLowerCase();
        const hit = (nameNeedle && blob.includes(nameNeedle.split(' ')[0]))
          || (emailNeedle && blob.includes(emailNeedle));
        if (!hit) continue;
        const others = Array.isArray(z.others) ? (z.others as unknown[]).map(String).join('\n') : '';
        const text = [String(z.title || ''), String(z.ai_summary || ''), others].filter(Boolean).join('\n');
        push('Zoom notes', (z.note_date || z.created_at) as string | Date | null | undefined, text);
      }
    } catch (err) {
      fail('reach_notes_zoom', err);
    }
  }

  if (person?.notes && !notes.some((n) => n.text === person.notes)) {
    push('List', null, person.notes);
  }

  notes.sort((a, b) => String(b.when).localeCompare(String(a.when)));
  return { notes, person };
}

/* Public business phone / email found for firms on the lists (data/contact-fills.json, each with its source).
   Only fills blanks; anything already on the row or in GoHighLevel wins. */
function fillKey(v: string) {
  return String(v || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}
function fillPublicContacts(people: ReachListPerson[]) {
  const map = new Map<string, { phone?: string; email?: string }>();
  for (const f of fills as Array<{ company: string; phone?: string; email?: string }>) {
    map.set(fillKey(f.company), f);
  }
  for (const p of people) {
    /* A named regulator contact keeps their own details; the agency's general line only fills the agency rows. */
    if (/regulator/i.test(p.role) && fillKey(p.name) !== fillKey(p.company)) continue;
    const hit = map.get(fillKey(p.company)) || map.get(fillKey(p.name));
    if (!hit) continue;
    if (!p.phone && hit.phone) p.phone = clip(hit.phone, 40);
    if (!p.email && hit.email) p.email = clip(hit.email, 180);
  }
}

async function keepLastGood(sql: Sql, ownerId: string, key: string, people: ReachListPerson[]): Promise<ReachListPerson[]> {
  try {
    await sql`CREATE TABLE IF NOT EXISTS reach_list_cache (
      owner_id text NOT NULL, list_key text NOT NULL, people jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, list_key)
    )`;
    if (people.length) {
      await sql`INSERT INTO reach_list_cache (owner_id, list_key, people, saved_at)
        VALUES (${ownerId}, ${key}, ${JSON.stringify(people)}::jsonb, now())
        ON CONFLICT (owner_id, list_key) DO UPDATE SET people = EXCLUDED.people, saved_at = now()`;
      return people;
    }
    const rows = await sql`SELECT people FROM reach_list_cache WHERE owner_id = ${ownerId} AND list_key = ${key} LIMIT 1`;
    const cached = rows[0]?.people;
    return Array.isArray(cached) ? (cached as ReachListPerson[]) : people;
  } catch (err) {
    fail('reach_cache', err);
    return people;
  }
}
