import { currentCreds } from './creds';
import { env } from './env.mjs';

const BASE = 'https://services.leadconnectorhq.com';

function configured() {
  return !!(currentCreds().ghlKey.trim() || env('GHL_API_KEY') || env('GOHIGHLEVEL_API_KEY'));
}

export function ghlConfigured() {
  return configured();
}

function key() {
  return (currentCreds().ghlKey || env('GHL_API_KEY') || env('GOHIGHLEVEL_API_KEY')).trim();
}

function locationId() {
  return (currentCreds().ghlLocation || env('GHL_LOCATION_ID') || env('GOHIGHLEVEL_LOCATION_ID')).trim();
}

async function ghl(path: string, init?: { method?: string; body?: string }) {
  if (!configured() || !locationId()) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init?.method || 'GET',
      headers: {
        authorization: `Bearer ${key()}`,
        version: '2021-07-28',
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init?.body,
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export type GhlContact = {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
};

export async function listContacts() {
  const loc = encodeURIComponent(locationId());
  const json = (await ghl(`/contacts/?locationId=${loc}&limit=50`)) as {
    contacts?: Array<Record<string, unknown>>;
  } | null;
  if (!json) return { status: 'unavailable' as const, contacts: [] as GhlContact[] };
  const contacts = (json.contacts || []).slice(0, 50).map((row) => ({
    id: String(row.id || ''),
    name: String(row.contactName || `${row.firstName || ''} ${row.lastName || ''}`).trim() || 'Contact',
    company: String(row.companyName || ''),
    role: String(row.type || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
  })).filter((row) => row.id);
  return { status: contacts.length ? ('connected' as const) : ('reached_empty' as const), contacts };
}

function titleStage(name: string) {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length < 3 || clean !== clean.toUpperCase()) return clean;
  return clean.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

function postsOf(json: Record<string, unknown> | null) {
  if (!json) return [] as Array<{ status?: string }>;
  const raw = json.posts ?? json.results ?? json.data;
  if (Array.isArray(raw)) return raw as Array<{ status?: string }>;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { posts?: unknown[] }).posts)) {
    return (raw as { posts: Array<{ status?: string }> }).posts;
  }
  return [];
}

export async function listSocialQueue() {
  const loc = encodeURIComponent(locationId());
  const posts: Array<{ status?: string; scheduleDate?: string; scheduledAt?: string; publishAt?: string }> = [];
  let reached = false;
  for (const skip of [0, 20, 40, 60, 80]) {
    let json = (await ghl(`/social-media-posting/${loc}/posts?limit=20&skip=${skip}`)) as Record<string, unknown> | null;
    if (!postsOf(json).length) {
      const listed = (await ghl(`/social-media-posting/${loc}/posts/list`, {
        method: 'POST',
        body: JSON.stringify({ skip, limit: 20 }),
      })) as Record<string, unknown> | null;
      if (postsOf(listed).length) json = listed;
    }
    if (json) reached = true;
    const batch = postsOf(json) as Array<{ status?: string; scheduleDate?: string; scheduledAt?: string; publishAt?: string }>;
    if (!batch.length) break;
    posts.push(...batch);
    if (batch.length < 20) break;
  }
  if (!reached) return null;
  const queued = posts.filter((post) => /schedul|queue|draft|pending|in_progress|in progress/i.test(String(post.status || 'scheduled')));
  const left = queued.length || posts.length;
  const cadence = left ? Math.max(1, Math.round(left / 7) || 1) : 0;
  const dates = queued.map((post) => Date.parse(String(post.scheduleDate || post.scheduledAt || post.publishAt || ''))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const newsletterDue = dates[0] ? new Date(dates[0]).toISOString().slice(0, 10) : '';
  return { left, cadence, newsletterDue, empty: left === 0 };
}

export async function listPipeline() {
  const all = await listPipelines();
  if (all.status === 'unavailable') return { status: 'unavailable' as const, stages: [] as Array<{ stage: string; count: number; detail: string }>, touches: [] as Array<{ sourceId: string; name: string; at: string }> };
  const counts = new Map<string, number>();
  const touches: Array<{ sourceId: string; name: string; at: string }> = [];
  for (const pipe of all.pipelines) {
    for (const stage of pipe.stages) {
      counts.set(stage.name, (counts.get(stage.name) || 0) + stage.count);
      for (const opp of stage.opps) {
        if (opp.updatedAt && (opp.contactId || opp.contact)) touches.push({ sourceId: opp.contactId, name: opp.contact, at: opp.updatedAt });
      }
    }
  }
  const stages = [...counts.entries()].map(([stage, count]) => ({
    stage,
    count,
    detail: count === 1 ? '1 opportunity' : `${count} opportunities`,
  }));
  touches.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { status: stages.length ? ('connected' as const) : ('reached_empty' as const), stages, touches: touches.slice(0, 120) };
}

export async function createContact(input: { name: string; company?: string; email?: string }) {
  const name = String(input.name || '').trim().slice(0, 120);
  if (!name) return null;
  const [first, ...rest] = name.split(' ');
  const json = (await ghl('/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      locationId: locationId(),
      firstName: first,
      lastName: rest.join(' '),
      name,
      companyName: String(input.company || '').slice(0, 120),
      email: String(input.email || ''),
    }),
  })) as { contact?: { id?: string } } | null;
  return json?.contact?.id ? String(json.contact.id) : null;
}

const STAGE_WORDS: Array<[string, string]> = [
  ['committed', 'committed'],
  ['meeting', 'meeting'],
  ['replied', 'replied'],
  ['reply', 'replied'],
  ['sent', 'sent'],
  ['ready', 'ready'],
  ['draft', 'draft'],
];

export function localStageName(label: string) {
  const name = String(label || '').toLowerCase();
  for (const [word, stage] of STAGE_WORDS) {
    if (name === word || name.includes(word)) return stage;
  }
  return '';
}

export async function ensureGhlContact(input: { name: string; company?: string; email?: string }) {
  const email = String(input.email || '').trim();
  if (!configured() || !locationId()) return '';
  if (email) {
    const found = (await ghl(`/contacts/search/duplicate?locationId=${encodeURIComponent(locationId())}&email=${encodeURIComponent(email)}`)) as {
      contact?: { id?: string };
    } | null;
    if (found?.contact?.id) return String(found.contact.id);
  }
  return (await createContact(input)) || '';
}

export async function sendViaGhl(input: { contactId: string; email: string; subject: string; html: string }) {
  if (!configured() || !locationId() || !input.contactId) return false;
  const json = await ghl('/conversations/messages', {
    method: 'POST',
    body: JSON.stringify({
      type: 'Email',
      contactId: input.contactId,
      locationId: locationId(),
      emailTo: String(input.email || ''),
      emailFrom: 'chad@4ormfinance.com',
      subject: String(input.subject || '4orm Finance').slice(0, 200),
      html: String(input.html || '').slice(0, 8000),
      message: String(input.html || '').slice(0, 8000),
    }),
  });
  return !!json;
}

export async function pushOpportunity(input: { name: string; contactId: string; stage: string; opportunityId?: string }) {
  if (!configured() || !locationId() || !input.contactId) return '';
  const pipes = (await ghl(`/opportunities/pipelines?locationId=${encodeURIComponent(locationId())}`)) as {
    pipelines?: Array<{ id?: string; stages?: Array<{ id?: string; name?: string }> }>;
  } | null;
  let pipelineId = '';
  let stageId = '';
  const want = String(input.stage || '').toLowerCase();
  for (const pipe of pipes?.pipelines || []) {
    for (const stage of pipe.stages || []) {
      const stageName = String(stage.name || '');
      const local = localStageName(stageName);
      if (pipe.id && stage.id && (stageName.toLowerCase() === want || (local && local === want))) {
        pipelineId = String(pipe.id);
        stageId = String(stage.id);
      }
    }
  }
  if (!pipelineId || !stageId) return '';
  if (input.opportunityId) {
    // An existing opportunity is only ever moved. A failed move never falls through to creating a second one.
    const updated = await ghl(`/opportunities/${encodeURIComponent(input.opportunityId)}`, {
      method: 'PUT',
      body: JSON.stringify({ pipelineId, pipelineStageId: stageId }),
    });
    return updated ? input.opportunityId : '';
  }
  const created = (await ghl('/opportunities/', {
    method: 'POST',
    body: JSON.stringify({
      locationId: locationId(),
      pipelineId,
      pipelineStageId: stageId,
      name: String(input.name || 'Space').slice(0, 120),
      contactId: input.contactId,
      status: 'open',
    }),
  })) as { opportunity?: { id?: string } } | null;
  return created?.opportunity?.id ? String(created.opportunity.id) : '';
}

export type OpportunityMove = { ok: true; opportunityId: string } | { ok: false; status: 400 | 404 | 409 | 502 | 503; note: string };

/**
 * Move an existing opportunity to a stage. Never creates one.
 * pipelineId + stageId are used when they name a real stage; otherwise the stage name is resolved.
 * 404 = GoHighLevel no longer has that opportunity; 409 = the stage is not in that pipeline / GHL refused it.
 */
export async function moveOpportunityStage(input: { opportunityId: string; pipelineId?: string; stageId?: string; stage?: string }): Promise<OpportunityMove> {
  if (!configured() || !locationId()) return { ok: false, status: 503, note: 'GoHighLevel is not connected.' };
  const oppId = String(input.opportunityId || '').trim();
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(oppId)) return { ok: false, status: 400, note: 'That opportunity id is not valid.' };
  const pipes = (await ghl(`/opportunities/pipelines?locationId=${encodeURIComponent(locationId())}`)) as {
    pipelines?: Array<{ id?: string; stages?: Array<{ id?: string; name?: string }> }>;
  } | null;
  if (!pipes) return { ok: false, status: 502, note: 'GoHighLevel did not answer.' };
  let pipelineId = '';
  let stageId = '';
  const wantPipe = String(input.pipelineId || '');
  const wantStage = String(input.stageId || '');
  const wantName = String(input.stage || '').toLowerCase();
  for (const pipe of pipes.pipelines || []) {
    for (const stage of pipe.stages || []) {
      if (!pipe.id || !stage.id) continue;
      if (wantStage && String(stage.id) === wantStage && (!wantPipe || String(pipe.id) === wantPipe)) {
        pipelineId = String(pipe.id);
        stageId = String(stage.id);
      }
    }
  }
  if (!stageId && !wantStage && wantName) {
    for (const pipe of pipes.pipelines || []) {
      if (wantPipe && String(pipe.id) !== wantPipe) continue;
      for (const stage of pipe.stages || []) {
        const name = String(stage.name || '');
        if (pipe.id && stage.id && (name.toLowerCase() === wantName || localStageName(name) === wantName)) {
          pipelineId = String(pipe.id);
          stageId = String(stage.id);
        }
      }
    }
  }
  if (!pipelineId || !stageId) return { ok: false, status: 409, note: 'That stage is not in this pipeline in GoHighLevel.' };
  try {
    const res = await fetch(`${BASE}/opportunities/${encodeURIComponent(oppId)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${key()}`,
        version: '2021-07-28',
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ pipelineId, pipelineStageId: stageId }),
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) return { ok: true, opportunityId: oppId };
    if (res.status === 404) return { ok: false, status: 404, note: 'That opportunity is no longer in GoHighLevel.' };
    if (res.status === 400 || res.status === 409 || res.status === 422) return { ok: false, status: 409, note: 'GoHighLevel did not take that stage.' };
    return { ok: false, status: 502, note: 'GoHighLevel did not take that stage.' };
  } catch {
    return { ok: false, status: 502, note: 'GoHighLevel did not answer.' };
  }
}

export async function opportunityStages() {
  const all = await listPipelines();
  const out: Array<{ id: string; stage: string }> = [];
  for (const pipe of all.pipelines) {
    for (const stage of pipe.stages) {
      const local = localStageName(stage.name);
      if (!local) continue;
      for (const opp of stage.opps) if (opp.id) out.push({ id: opp.id, stage: local });
    }
  }
  return out;
}

export async function repliedInbound(contactId: string) {
  if (!contactId) return false;
  const json = (await ghl(`/conversations/search?locationId=${encodeURIComponent(locationId())}&contactId=${encodeURIComponent(contactId)}`)) as {
    conversations?: Array<Record<string, unknown>>;
  } | null;
  const row = json?.conversations?.[0];
  if (!row) return false;
  const direction = String(row.lastMessageDirection || '').toLowerCase();
  return direction.includes('inbound');
}

/** Round 3 (B56): GHL contact id for an email, or '' (never creates a contact). */
export async function findGhlContactId(email: string) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || !configured() || !locationId()) return '';
  const found = (await ghl(`/contacts/search/duplicate?locationId=${encodeURIComponent(locationId())}&email=${encodeURIComponent(clean)}`)) as {
    contact?: { id?: string };
  } | null;
  return found?.contact?.id ? String(found.contact.id) : '';
}

/** Round 3 (B56): add or remove tags on one GHL contact (POST / DELETE /contacts/{id}/tags { tags }). */
export async function setGhlContactTags(contactId: string, tags: string[], mode: 'add' | 'remove') {
  if (!contactId || !tags.length) return false;
  const json = await ghl(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: mode === 'add' ? 'POST' : 'DELETE',
    body: JSON.stringify({ tags: tags.slice(0, 20) }),
  });
  return !!json;
}

export async function addGhlTask(contactId: string, title: string) {
  if (!contactId) return false;
  const json = await ghl(`/contacts/${encodeURIComponent(contactId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title: title.slice(0, 180), completed: false }),
  });
  return !!json;
}

export async function listReminders() {
  const loc = locationId();
  if (!loc) return { status: 'unavailable' as const, tasks: [] as Array<{ id: string; title: string; due: string | null }> };
  const json = (await ghl(`/locations/${encodeURIComponent(loc)}/tasks?limit=30`)) as {
    tasks?: Array<Record<string, unknown>>;
  } | null;
  if (!json) return { status: 'unavailable' as const, tasks: [] };
  const tasks = (json.tasks || []).slice(0, 30).map((row) => ({
    id: String(row.id || ''),
    title: String(row.title || row.body || 'Follow up').slice(0, 180),
    due: row.dueDate ? String(row.dueDate) : null,
  })).filter((row) => row.id);
  return { status: tasks.length ? ('connected' as const) : ('reached_empty' as const), tasks };
}

export type GhlOpp = { id: string; name: string; contactId: string; contact: string; company: string; email: string; value: number; status: string; updatedAt: string; stageChangedAt?: string };

/** When the opportunity last moved stage (GHL lastStageChangeAt), else its last status change / update. */
function stageChangedOf(row: Record<string, unknown>) {
  return String(row.lastStageChangeAt || row.lastStatusChangeAt || row.updatedAt || row.createdAt || '').slice(0, 40);
}
export type GhlStage = { id: string; name: string; count: number; value: number; opps: GhlOpp[] };
export type GhlPipeline = { id: string; name: string; total: number; value: number; stages: GhlStage[] };

async function pipelineOpps(pipelineId: string) {
  const loc = encodeURIComponent(locationId());
  const pid = encodeURIComponent(pipelineId);
  const rows: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 5; page += 1) {
    let json = (await ghl(`/opportunities/search?location_id=${loc}&pipeline_id=${pid}&limit=100&page=${page}`)) as {
      opportunities?: Array<Record<string, unknown>>;
    } | null;
    if (!json && page === 1) {
      json = (await ghl('/opportunities/search', {
        method: 'POST',
        body: JSON.stringify({ locationId: locationId(), query: '', limit: 100, page, pipelineId }),
      })) as { opportunities?: Array<Record<string, unknown>> } | null;
    }
    if (!json) return page === 1 ? null : rows;
    const list = (json.opportunities || []).filter((row) => !row.pipelineId || String(row.pipelineId) === pipelineId);
    rows.push(...list);
    if ((json.opportunities || []).length < 100) break;
  }
  return rows;
}

export async function getContact(id: string) {
  const json = (await ghl(`/contacts/${encodeURIComponent(id)}`)) as { contact?: Record<string, unknown> } | null;
  const row = json?.contact || json;
  if (!row || typeof row !== 'object') return null;
  const contact = row as Record<string, unknown>;
  const idValue = String(contact.id || id || '');
  if (!idValue) return null;
  return {
    id: idValue,
    name: String(contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`).trim() || 'Contact',
    company: String(contact.companyName || ''),
    role: String(contact.type || ''),
    email: String(contact.email || ''),
    phone: String(contact.phone || ''),
  };
}

export async function getOpportunity(id: string) {
  const json = (await ghl(`/opportunities/${encodeURIComponent(id)}`)) as { opportunity?: Record<string, unknown> } | Record<string, unknown> | null;
  const row = (json && typeof json === 'object' && 'opportunity' in json ? json.opportunity : json) as Record<string, unknown> | undefined;
  if (!row || !row.id) return null;
  const contact = (row.contact || {}) as { name?: string; companyName?: string; email?: string; id?: string };
  return {
    id: String(row.id),
    name: String(row.name || '').slice(0, 120),
    pipelineId: String(row.pipelineId || ''),
    pipelineStageId: String(row.pipelineStageId || ''),
    contactId: String(row.contactId || contact.id || ''),
    contact: String(contact.name || row.name || '').slice(0, 120),
    company: String(contact.companyName || '').slice(0, 120),
    email: String(contact.email || '').slice(0, 120),
    value: Number(row.monetaryValue) || 0,
    status: String(row.status || 'open').slice(0, 20),
    updatedAt: String(row.updatedAt || row.lastStatusChangeAt || row.createdAt || '').slice(0, 40),
    stageChangedAt: stageChangedOf(row),
  };
}

export function shapePipelineStages(pipelines: GhlPipeline[]) {
  const counts = new Map<string, number>();
  for (const pipe of pipelines) {
    for (const stage of pipe.stages) counts.set(stage.name, (counts.get(stage.name) || 0) + stage.count);
  }
  return [...counts.entries()].map(([stage, count]) => ({
    stage,
    count,
    detail: count === 1 ? '1 opportunity' : `${count} opportunities`,
  }));
}

export function patchPipelines(pipelines: GhlPipeline[], opp: NonNullable<Awaited<ReturnType<typeof getOpportunity>>>, stageName = '') {
  const next = pipelines.map((pipe) => ({
    ...pipe,
    stages: pipe.stages.map((stage) => ({ ...stage, opps: stage.opps.filter((row) => row.id !== opp.id) })),
  }));
  const pipe = next.find((row) => row.id === opp.pipelineId) || next[0];
  if (!pipe) return pipelines;
  const stage =
    pipe.stages.find((row) => row.id === opp.pipelineStageId) ||
    pipe.stages.find((row) => stageName && row.name.toLowerCase() === stageName.toLowerCase());
  if (!stage) return pipelines;
  stage.opps.unshift({
    id: opp.id,
    name: opp.name,
    contactId: opp.contactId,
    contact: opp.contact,
    company: opp.company,
    email: opp.email,
    value: opp.value,
    status: opp.status,
    updatedAt: opp.updatedAt,
    stageChangedAt: opp.stageChangedAt || opp.updatedAt,
  });
  for (const row of next) {
    for (const item of row.stages) {
      item.count = item.opps.length;
      item.value = item.opps.reduce((n, hit) => n + (Number(hit.value) || 0), 0);
    }
    row.total = row.stages.reduce((n, item) => n + item.count, 0);
    row.value = row.stages.reduce((n, item) => n + item.value, 0);
  }
  return next;
}

export async function listPipelines() {
  if (!configured() || !locationId()) return { status: 'unavailable' as const, pipelines: [] as GhlPipeline[] };
  const pipes = (await ghl(`/opportunities/pipelines?locationId=${encodeURIComponent(locationId())}`)) as {
    pipelines?: Array<{ id?: string; name?: string; stages?: Array<{ id?: string; name?: string; position?: number }> }>;
  } | null;
  if (!pipes) return { status: 'unavailable' as const, pipelines: [] as GhlPipeline[] };
  const list = (pipes.pipelines || []).filter((pipe) => pipe.id);
  const opps = await Promise.all(list.map((pipe) => pipelineOpps(String(pipe.id)).catch(() => null)));
  const pipelines: GhlPipeline[] = list.map((pipe, ix) => {
    const rows = opps[ix] || [];
    const stages: GhlStage[] = (pipe.stages || [])
      .filter((stage) => stage.id)
      .slice()
      .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
      .map((stage) => ({ id: String(stage.id), name: titleStage(String(stage.name || 'Stage').replace(/\s+/g, ' ').trim()).slice(0, 80), count: 0, value: 0, opps: [] as GhlOpp[] }));
    const byId = new Map(stages.map((stage) => [stage.id, stage]));
    for (const row of rows) {
      const stage = byId.get(String(row.pipelineStageId || ''));
      if (!stage) continue;
      const contact = (row.contact || {}) as { name?: string; companyName?: string; email?: string };
      const value = Number(row.monetaryValue) || 0;
      stage.count += 1;
      stage.value += value;
      if (stage.opps.length < 60) {
        stage.opps.push({
          id: String(row.id || ''),
          name: String(row.name || '').slice(0, 120),
          contactId: String(row.contactId || ''),
          contact: String(contact.name || row.name || '').slice(0, 120),
          company: String(contact.companyName || '').slice(0, 120),
          email: String(contact.email || '').slice(0, 120),
          value,
          status: String(row.status || 'open').slice(0, 20),
          updatedAt: String(row.updatedAt || row.lastStatusChangeAt || row.createdAt || '').slice(0, 40),
          stageChangedAt: stageChangedOf(row),
        });
      }
    }
    return {
      id: String(pipe.id),
      name: String(pipe.name || 'Pipeline').slice(0, 80),
      total: stages.reduce((n, stage) => n + stage.count, 0),
      value: stages.reduce((n, stage) => n + stage.value, 0),
      stages,
    };
  });
  return { status: pipelines.length ? ('connected' as const) : ('reached_empty' as const), pipelines };
}

const TEST_PIPE_NAME = '4orm TEST';

async function ghlAny(path: string, init?: { method?: string; body?: string }) {
  if (!configured() || !locationId()) return { ok: false, json: null as unknown, status: 0 };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init?.method || 'GET',
      headers: {
        authorization: `Bearer ${key()}`,
        version: '2021-07-28',
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init?.body,
      signal: AbortSignal.timeout(12000),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, json, status: res.status };
  } catch {
    return { ok: false, json: null as unknown, status: 0 };
  }
}

/** TEST pipeline + TEST opportunity only. Never moves a card whose name does not start with TEST. */
export async function testOpportunityRail(step: 'ensure' | 'move' | 'archive', input?: { opportunityId?: string; stageId?: string; pipelineId?: string }) {
  if (!configured() || !locationId()) return { ok: false as const, note: 'GoHighLevel is not connected.' };
  const loc = locationId();
  const listed = await ghlAny(`/opportunities/pipelines?locationId=${encodeURIComponent(loc)}`);
  const pipes = ((listed.json as { pipelines?: Array<{ id?: string; name?: string; stages?: Array<{ id?: string; name?: string }> }> } | null)?.pipelines) || [];
  let pipe = pipes.find((p) => String(p.name || '') === TEST_PIPE_NAME) || pipes.find((p) => /4orm\s*TEST/i.test(String(p.name || '')));
  if (!pipe && step === 'ensure') {
    const created = await ghlAny('/opportunities/pipelines/', {
      method: 'POST',
      body: JSON.stringify({
        locationId: loc,
        name: TEST_PIPE_NAME,
        stages: [{ name: 'Open', position: 0 }, { name: 'Next', position: 1 }, { name: 'Done', position: 2 }],
      }),
    });
    const row = created.json as { pipeline?: { id?: string; name?: string; stages?: Array<{ id?: string; name?: string }> } } | null;
    if (row?.pipeline?.id) pipe = row.pipeline;
  }
  if (!pipe?.id) return { ok: false as const, note: 'No 4orm TEST pipeline in GoHighLevel.' };
  const stages = (pipe.stages || []).filter((s) => s.id);
  if (stages.length < 2) return { ok: false as const, note: '4orm TEST needs two stages.' };

  if (step === 'ensure') {
    const contactId = await ensureGhlContact({ name: 'TEST 4ormop', email: 'opstest@4ormfinance.com' });
    if (!contactId) return { ok: false as const, note: 'Could not make the TEST contact.' };
    const listed = await listPipelines();
    const current = listed.pipelines.find((p) => String(p.id) === String(pipe.id));
    const existing = (current?.stages || []).flatMap((s) => s.opps || []).find((o) => /^TEST 4ormop drag/i.test(String(o.name || '')) && String(o.status || '') !== 'lost');
    let opportunityId = String(existing?.id || '');
    let stageId = String(existing ? (current?.stages.find((s) => s.opps.some((o) => o.id === existing.id))?.id || stages[0].id) : '');
    if (!opportunityId) {
      const created = await ghlAny('/opportunities/', {
        method: 'POST',
        body: JSON.stringify({
          locationId: loc,
          pipelineId: pipe.id,
          pipelineStageId: stages[0].id,
          name: `TEST 4ormop drag ${Date.now()}`,
          contactId,
          status: 'open',
        }),
      });
      const opp = created.json as { opportunity?: { id?: string; pipelineStageId?: string; name?: string } } | null;
      opportunityId = String(opp?.opportunity?.id || '');
      stageId = String(opp?.opportunity?.pipelineStageId || stages[0].id);
    }
    if (!opportunityId) {
      const fallback = await ghlAny(`/opportunities/search?location_id=${encodeURIComponent(loc)}&q=${encodeURIComponent('TEST 4ormop drag')}`);
      const hits = (fallback.json as { opportunities?: Array<{ id?: string; pipelineStageId?: string; status?: string; name?: string }> } | null)?.opportunities || [];
      const hit = hits.find((o) => /^TEST 4ormop drag/i.test(String(o.name || '')) && String(o.status || '') !== 'lost');
      opportunityId = String(hit?.id || '');
      stageId = String(hit?.pipelineStageId || stageId || stages[0].id);
    }
    if (!opportunityId) return { ok: false as const, note: 'GoHighLevel did not create the TEST opportunity.' };
    return {
      ok: true as const,
      pipelineId: String(pipe.id),
      pipelineName: String(pipe.name || TEST_PIPE_NAME),
      opportunityId,
      stageId: stageId || String(stages[0].id),
      stages: stages.map((s) => ({ id: String(s.id), name: String(s.name || '') })),
    };
  }

  const opportunityId = String(input?.opportunityId || '');
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(opportunityId)) return { ok: false as const, note: 'That opportunity id is not valid.' };
  const got = await ghlAny(`/opportunities/${encodeURIComponent(opportunityId)}`);
  const opp = (got.json as { opportunity?: { id?: string; name?: string; pipelineId?: string; pipelineStageId?: string; status?: string } } | null)?.opportunity;
  if (!opp?.id || !/^TEST\b/i.test(String(opp.name || ''))) return { ok: false as const, note: 'Refusing to touch a non-TEST opportunity.' };
  if (String(opp.pipelineId || '') !== String(pipe.id) && String(input?.pipelineId || '') !== String(pipe.id)) {
    if (String(opp.pipelineId || '') && !/test/i.test(String(pipe.name || ''))) return { ok: false as const, note: 'That opportunity is not on 4orm TEST.' };
  }

  if (step === 'move') {
    const stageId = String(input?.stageId || '');
    if (!stages.some((s) => String(s.id) === stageId)) return { ok: false as const, note: 'That stage is not on 4orm TEST.' };
    const moved = await moveOpportunityStage({ opportunityId, pipelineId: String(pipe.id), stageId });
    if (!moved.ok) return { ok: false as const, note: moved.note };
    const check = await ghlAny(`/opportunities/${encodeURIComponent(opportunityId)}`);
    const now = (check.json as { opportunity?: { pipelineStageId?: string } } | null)?.opportunity;
    return {
      ok: true as const,
      opportunityId,
      pipelineId: String(pipe.id),
      stageId: String(now?.pipelineStageId || stageId),
      stages: stages.map((s) => ({ id: String(s.id), name: String(s.name || '') })),
    };
  }

  await ghlAny(`/opportunities/${encodeURIComponent(opportunityId)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'lost' }),
  });
  return { ok: true as const, opportunityId, archived: true, pipelineId: String(pipe.id), stages: stages.map((s) => ({ id: String(s.id), name: String(s.name || '') })) };
}
