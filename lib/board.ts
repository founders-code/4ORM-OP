import type { NeonQueryFunction } from '@neondatabase/serverless';
import { syncCalendar, syncDrive, syncGhl, calendarPayload, ingestMail } from './sync';

type Sql = NeonQueryFunction<false, false>;

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const WORD: Record<string, { state: string; word: string }> = {
  connected: { state: 'ok', word: 'Connected' },
  reached_empty: { state: 'ok', word: 'Reached, empty' },
  stale: { state: 'warn', word: 'Stale' },
  unavailable: { state: 'off', word: 'Unavailable' },
};

function tone(status: string | undefined) {
  return WORD[status || ''] || WORD.unavailable;
}

const INTEGRATIONS = [
  { source: 'gmail', nm: 'Gmail', feeds: 'Mail that becomes tasks', color: '#D6334E', ic: '@', scopes: 'read' },
  { source: 'calendar', nm: 'Google Calendar', feeds: 'Calendar tab, drag to reschedule', color: '#2E6BF2', ic: '#', scopes: 'read · write' },
  { source: 'drive', nm: 'Google Drive', feeds: 'Documents and Drive, one folder tree', color: '#0E8A5F', ic: 'D', scopes: 'read · write' },
  { source: 'ghl', nm: 'GoHighLevel', feeds: 'Pipeline, reminders, contacts', color: '#8A5200', ic: 'G', scopes: 'read' },
  { source: 'brief', nm: 'Morning brief', feeds: 'Weekday 6:00 America/Edmonton', color: '#1B7BB5', ic: '*', scopes: 'scheduled' },
];

type Folder = {
  id: string;
  name: string;
  url: string;
  children: Folder[];
  docs: { id: string; name: string; url: string; kind: string }[];
};

function asFolders(nodes: Array<Record<string, unknown>> | undefined): Folder[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => ({
    id: String(node.id || ''),
    name: String(node.name || ''),
    url: String(node.url || ''),
    docs: Array.isArray(node.files)
      ? (node.files as Array<Record<string, unknown>>).map((file) => ({
          id: String(file.id || ''),
          name: String(file.name || ''),
          url: String(file.url || ''),
          kind: String(file.kind || 'file'),
        }))
      : [],
    children: asFolders(node.children as Array<Record<string, unknown>> | undefined)
      .concat(asFolders(node.folders as Array<Record<string, unknown>> | undefined)),
  }));
}

async function quiet(job: Promise<unknown>) {
  try {
    await job;
  } catch {
    /* a source that throws stays on its last status word */
  }
}

export async function loadBoard(sql: Sql, ownerId: string) {
  await quiet(ingestMail(sql, ownerId));
  await quiet(syncCalendar(sql, ownerId));
  await quiet(syncDrive(sql, ownerId));
  await quiet(syncGhl(sql, ownerId));

  const items = await sql`
    SELECT id, title, area, status, priority, due, owner, source
    FROM items
    WHERE owner_id = ${ownerId}
      AND (snooze_until IS NULL OR snooze_until <= now())
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  const contacts = await sql`
    SELECT id, name, company, role, email, phone, area, notes
    FROM contacts
    WHERE owner_id = ${ownerId}
    ORDER BY name
    LIMIT 200
  `;
  const categories = await sql`
    SELECT name, subs FROM link_categories WHERE owner_id = ${ownerId} ORDER BY name
  `;
  const links = await sql`
    SELECT title, url, category, sub FROM links WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT 200
  `;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const briefs = await sql`
    SELECT headline, summary, top_three
    FROM daily_brief
    WHERE owner_id = ${ownerId} AND brief_date = ${today}
  `;
  const stages = await sql`
    SELECT stage, count, detail FROM pipeline_stages WHERE owner_id = ${ownerId} ORDER BY stage
  `;
  const states = await sql`
    SELECT source, status, detail, synced_at FROM sync_state WHERE owner_id = ${ownerId}
  `;
  const cached = await sql`SELECT tree FROM drive_cache WHERE owner_id = ${ownerId}`;
  const events = await calendarPayload(sql, ownerId);

  const bySource = new Map<string, { status: string; detail: string; synced_at: string | null }>();
  for (const row of states) {
    bySource.set(String(row.source), {
      status: String(row.status || 'unavailable'),
      detail: String(row.detail || ''),
      synced_at: row.synced_at ? String(row.synced_at) : null,
    });
  }

  const open = items.filter((row) => row.status !== 'done' && row.status !== 'dropped');
  const overdue = open.filter((row) => row.due && new Date(String(row.due)).getTime() < Date.now()).length;
  const reached = ['gmail', 'calendar', 'ghl', 'drive'].some((key) => {
    const status = bySource.get(key)?.status;
    return status === 'connected' || status === 'reached_empty';
  });

  const signals = [
    {
      nm: 'Morning brief',
      ...tone(briefs[0] ? 'connected' : bySource.get('brief')?.status || 'unavailable'),
      sub: briefs[0] ? 'Top three ready' : 'No brief for today',
    },
    {
      nm: 'Overdue',
      state: overdue ? 'bad' : 'ok',
      word: overdue ? `${overdue} items` : 'None',
      sub: overdue ? 'Needs a decision' : 'Nothing past due',
    },
    ...['gmail', 'calendar', 'drive', 'ghl'].map((key) => {
      const row = bySource.get(key);
      const meta = INTEGRATIONS.find((item) => item.source === key)!;
      const toneRow = tone(row?.status);
      return { nm: meta.nm, state: toneRow.state, word: toneRow.word, sub: row?.detail || toneRow.word };
    }),
  ];

  const briefRow = briefs[0];
  const top = asList(briefRow?.top_three);
  const brief = briefRow
    ? {
        headline: String(briefRow.headline || ''),
        summary: String(briefRow.summary || ''),
        top3: top.map((entry) => ({ t: String((entry as { t?: string }).t || '') })),
      }
    : reached || open.length
      ? { headline: 'No brief has been filed today.', summary: 'The desk is showing what is already stored.', top3: [] }
      : { headline: 'Sources unavailable.', summary: 'Mail, calendar, and GoHighLevel could not be reached.', top3: [] };

  const drives = asList(cached[0]?.tree) as Array<Record<string, unknown>>;
  const folders = drives.map((drive) => ({
    id: String(drive.id || ''),
    name: String(drive.name || ''),
    url: '',
    docs: Array.isArray(drive.files)
      ? (drive.files as Array<Record<string, unknown>>).map((file) => ({
          id: String(file.id || ''),
          name: String(file.name || ''),
          url: String(file.url || ''),
          kind: String(file.kind || 'file'),
        }))
      : [],
    children: asFolders(drive.folders as Array<Record<string, unknown>> | undefined),
  }));

  return {
    sourcesReached: reached || open.length > 0,
    signals,
    brief,
    pipeline: stages.map((row) => ({ s: String(row.stage), v: Number(row.count) || 0, d: String(row.detail || '') })),
    integrations: INTEGRATIONS.map((item) => {
      const row = bySource.get(item.source === 'brief' ? 'brief' : item.source);
      const status = item.source === 'brief' ? (briefs[0] ? 'connected' : row?.status || 'unavailable') : row?.status;
      const toneRow = tone(status);
      return {
        nm: item.nm,
        feeds: item.feeds,
        state: toneRow.state,
        word: toneRow.word,
        sync: row?.detail || 'Not run',
        color: item.color,
        ic: item.ic,
        scopes: item.scopes,
      };
    }),
    plugins: pluginStatus(),
    items: items.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      area: String(row.area),
      status: String(row.status),
      priority: String(row.priority),
      due: row.due ? new Date(String(row.due)).getTime() : null,
      owner: String(row.owner || ''),
      source: String(row.source || 'manual'),
    })),
    contacts: contacts.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      company: String(row.company || ''),
      role: String(row.role || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      area: String(row.area || 'other'),
      notes: String(row.notes || ''),
    })),
    categories: categories.map((row) => ({
      name: String(row.name),
      subs: asList(row.subs).map(String),
    })),
    links: links.map((row) => ({
      title: String(row.title),
      url: String(row.url),
      cat: String(row.category || ''),
      sub: String(row.sub || ''),
    })),
    events: (events as Array<Record<string, unknown>>).map((event) => ({
      id: String(event.id || ''),
      start: Number(event.start) || 0,
      dur: Number(event.dur) || 30,
      title: String(event.title || ''),
      color: '#2E6BF2',
    })),
    folders,
    drives: folders.map((folder) => ({ id: folder.id, name: folder.name, folders: folder.children, files: folder.docs })),
  };
}

/** Status words only. Keys stay in the server environment and are never returned. */
function pluginStatus() {
  const named = process.env.THIRD_MODEL_NAME?.trim();
  const thirdOn = !!(named && process.env.THIRD_MODEL_KEY);
  const rows = [
    ['anthropic', 'Anthropic', 'Model layer', 'A', '#C9785B', 'ANTHROPIC_API_KEY'],
    ['openai', 'OpenAI', 'Model layer', 'O', '#0E8A5F', 'OPENAI_API_KEY'],
    ['perplexity', 'Perplexity', 'Search', 'P', '#1B7BB5', 'PERPLEXITY_API_KEY'],
    ['riverside', 'Riverside', 'Recording', 'R', '#D6334E', 'RIVERSIDE_API_KEY'],
    ['vercel', 'Vercel', 'Hosting', 'V', '#111111', 'VERCEL_TOKEN'],
    ['cursor', 'Cursor', 'Editor', 'C', '#2E6BF2', 'CURSOR_API_KEY'],
  ] as const;
  const namedRow = (id: string, nm: string, kind: string, ic: string, color: string, on: boolean, word: string, desc: string) => ({
    id,
    nm,
    kind,
    ic,
    color,
    on,
    word,
    desc,
    report: [
      ['Status', word],
      ['Credential', on ? 'Present on the server' : 'Not set'],
    ],
  });
  return [
    namedRow('anthropic', rows[0][1], rows[0][2], rows[0][3], rows[0][4], !!process.env[rows[0][5]], process.env[rows[0][5]] ? 'Connected' : 'Not connected', process.env[rows[0][5]] ? 'A server credential is present.' : 'No server credential is set.'),
    namedRow('openai', rows[1][1], rows[1][2], rows[1][3], rows[1][4], !!process.env[rows[1][5]], process.env[rows[1][5]] ? 'Connected' : 'Not connected', process.env[rows[1][5]] ? 'A server credential is present.' : 'No server credential is set.'),
    namedRow('third', named || 'Third model', 'Confirm which provider', '3', '#8A5200', thirdOn, thirdOn ? 'Connected' : 'Confirm provider', 'The third model layer stays unwired until the provider is named.'),
    ...rows.slice(2).map((row) => {
      const on = !!process.env[row[5]];
      return namedRow(row[0], row[1], row[2], row[3], row[4], on, on ? 'Connected' : 'Not connected', on ? 'A server credential is present.' : 'No server credential is set.');
    }),
  ];
}
