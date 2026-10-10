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

async function ghl(path: string) {
  if (!configured() || !locationId()) return null;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      authorization: `Bearer ${key()}`,
      version: '2021-07-28',
      accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
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
  const json = (await ghl(`/opportunities/search?location_id=${loc}&limit=100`)) as {
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
