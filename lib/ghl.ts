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

export async function listSocialQueue() {
  const loc = encodeURIComponent(locationId());
  const json = (await ghl(`/social-media-posting/${loc}/posts?limit=20&skip=0`)) as {
    posts?: Array<{ status?: string }>;
    results?: Array<{ status?: string }>;
  } | null;
  if (!json) return null;
  const posts = json.posts || json.results || [];
  const queued = posts.filter((post) => /schedul|queue|draft|pending/i.test(String(post.status || 'scheduled')));
  const left = queued.length || posts.length;
  return { left, cadence: left ? Math.max(1, Math.round(left / 7)) : 0 };
}

export async function listPipeline() {
  const loc = encodeURIComponent(locationId());
  const pipes = (await ghl(`/opportunities/pipelines?locationId=${loc}`)) as {
    pipelines?: Array<{ stages?: Array<{ id?: string; name?: string }> }>;
  } | null;
  const names = new Map<string, string>();
  for (const pipe of pipes?.pipelines || []) {
    for (const stage of pipe.stages || []) {
      if (stage.id && stage.name) names.set(stage.id, stage.name);
    }
  }
  const json = (await ghl('/opportunities/search', {
    method: 'POST',
    body: JSON.stringify({ locationId: locationId(), limit: 100 }),
  })) as {
    opportunities?: Array<Record<string, unknown>>;
  } | null;
  if (!json) return { status: 'unavailable' as const, stages: [] as Array<{ stage: string; count: number; detail: string }> };
  const counts = new Map<string, number>();
  for (const row of json.opportunities || []) {
    const named = names.get(String(row.pipelineStageId || '')) || String(row.status || 'Open');
    const stage = titleStage(named).slice(0, 80);
    counts.set(stage, (counts.get(stage) || 0) + 1);
  }
  const stages = [...counts.entries()].map(([stage, count]) => ({
    stage,
    count,
    detail: count === 1 ? '1 opportunity' : `${count} opportunities`,
  }));
  return { status: stages.length ? ('connected' as const) : ('reached_empty' as const), stages };
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
  const pipes = (await ghl(`/opportunities/pipelines?locationId=${encodeURIComponent(locationId())}`)) as {
    pipelines?: Array<{ stages?: Array<{ id?: string; name?: string }> }>;
  } | null;
  const names = new Map<string, string>();
  for (const pipe of pipes?.pipelines || []) {
    for (const stage of pipe.stages || []) {
      const local = localStageName(String(stage.name || ''));
      if (stage.id && local) names.set(String(stage.id), local);
    }
  }
  const json = (await ghl('/opportunities/search', {
    method: 'POST',
    body: JSON.stringify({ locationId: locationId(), limit: 100 }),
  })) as { opportunities?: Array<Record<string, unknown>> } | null;
  if (!json) return [] as Array<{ id: string; stage: string }>;
  return (json.opportunities || []).map((row) => ({
    id: String(row.id || ''),
    stage: names.get(String(row.pipelineStageId || '')) || '',
  })).filter((row) => row.id && row.stage);
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
