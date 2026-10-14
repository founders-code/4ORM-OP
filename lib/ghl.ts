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
    const stage = named.slice(0, 80);
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

export async function sendMailboxEmail(to: string, subject: string, html: string) {
  const address = String(to || '').trim();
  if (!configured() || !locationId() || !address || !address.includes('@')) return false;
  const json = await ghl('/conversations/messages', {
    method: 'POST',
    body: JSON.stringify({
      type: 'Email',
      locationId: locationId(),
      emailTo: address,
      emailFrom: 'chad@4ormfinance.com',
      subject: String(subject || '4orm Finance').slice(0, 200),
      html: String(html || '').slice(0, 8000),
      message: String(html || '').slice(0, 8000),
    }),
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
