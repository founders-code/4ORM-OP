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
  let json = (await ghl(`/social-media-posting/${loc}/posts?limit=20&skip=0`)) as Record<string, unknown> | null;
  if (!postsOf(json).length) {
    const listed = (await ghl(`/social-media-posting/${loc}/posts/list`, {
      method: 'POST',
      body: JSON.stringify({ skip: 0, limit: 20 }),
    })) as Record<string, unknown> | null;
    if (postsOf(listed).length) json = listed;
  }
  const posts = postsOf(json);
  if (!json) return null;
  const queued = posts.filter((post) => /schedul|queue|draft|pending|in_progress|in progress/i.test(String(post.status || 'scheduled')));
  const left = queued.length || posts.length;
  if (!left) return null;
  return { left, cadence: Math.max(1, Math.round(left / 7)) };
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
      if (localStageName(String(stage.name || '')) === want && pipe.id && stage.id) {
        pipelineId = String(pipe.id);
        stageId = String(stage.id);
      }
    }
  }
  if (!pipelineId || !stageId) return '';
  if (input.opportunityId) {
    const updated = await ghl(`/opportunities/${encodeURIComponent(input.opportunityId)}`, {
      method: 'PUT',
      body: JSON.stringify({ pipelineId, pipelineStageId: stageId }),
    });
    if (updated) return input.opportunityId;
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

export type GhlOpp = { id: string; name: string; contactId: string; contact: string; company: string; email: string; value: number; status: string; updatedAt: string };
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
