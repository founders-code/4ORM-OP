import type { NeonQueryFunction } from '@neondatabase/serverless';
import { ROADMAP } from './roadmap.mjs';
import { idlePlugins, listPlugins } from './plugins';
import { listZoomNotes, seedZoomNotes } from './zoom-notes';
import { syncCalendar, syncDrive, syncGhl, calendarMeta, ingestMail } from './sync';

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
  reached_empty: { state: 'ok', word: 'Reached, nothing today' },
  not_connected: { state: 'off', word: 'Not connected' },
  stale: { state: 'warn', word: 'Stale' },
  unavailable: { state: 'off', word: 'Unavailable' },
};

function tone(status: string | undefined) {
  return WORD[status || ''] || WORD.unavailable;
}

const INTEGRATIONS = [
  { source: 'gmail', nm: 'Gmail', feeds: 'Mail that becomes tasks', color: '#D6334E', ic: '@', scopes: 'read', action: 'google' },
  { source: 'calendar', nm: 'Google Calendar', feeds: 'Calendar tab, drag to reschedule', color: '#2E6BF2', ic: '#', scopes: 'read · write', action: 'google' },
  { source: 'drive', nm: 'Google Drive', feeds: 'Documents and Drive, one folder tree', color: '#0E8A5F', ic: 'D', scopes: 'read · write', action: 'google' },
  { source: 'ghl', nm: 'GoHighLevel', feeds: 'Pipeline, reminders, contacts', color: '#8A5200', ic: 'G', scopes: 'read', action: 'ghl' },
  { source: 'brief', nm: 'Morning brief', feeds: 'Weekday 6:00 America/Edmonton', color: '#1B7BB5', ic: '*', scopes: 'scheduled', action: '' },
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

export function idleBoard(needsDatabase: boolean) {
  const off = { state: 'off', word: 'Not connected' };
  return {
    sourcesReached: false,
    needsDatabase,
    signals: [
      { nm: 'Morning brief', state: 'off', word: 'Unavailable', sub: 'No brief for today' },
      { nm: 'Overdue', state: 'ok', word: 'None', sub: 'Nothing past due' },
      ...INTEGRATIONS.filter((item) => item.action).map((item) => ({ nm: item.nm, ...off, sub: 'Not connected' })),
    ],
    brief: { headline: 'Sources unavailable.', summary: 'Mail, calendar, and GoHighLevel could not be reached.', top3: [] },
    pipeline: [],
    integrations: INTEGRATIONS.map((item) => ({
      nm: item.nm,
      feeds: item.feeds,
      state: 'off',
      word: 'Not connected',
      sync: 'Not run',
      color: item.color,
      ic: item.ic,
      scopes: item.scopes,
      action: item.action,
    })),
    plugins: idlePlugins(),
    items: [],
    contacts: [],
    categories: [],
    links: [],
    events: [],
    folders: [],
    drives: [],
    noteCats: [],
    notes: [],
    zoomNotes: [],
    runwayWeeks: null,
    calendarUntil: null,
  };
}

async function seedRoadmap(sql: Sql, ownerId: string) {
  const payload = JSON.stringify(ROADMAP);
  await sql`
    INSERT INTO items (owner_id, title, area, status, priority, due, owner, source, category)
    SELECT ${ownerId}, x.title, x.area, 'open', x.priority,
           (x.due::date + time '12:00') AT TIME ZONE 'America/Edmonton',
           x.owner, 'roadmap', x.category
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(title text, area text, priority text, due text, owner text, category text)
    WHERE NOT EXISTS (
      SELECT 1 FROM items WHERE owner_id = ${ownerId} AND source = 'roadmap'
    )
  `;
  await sql`
    UPDATE items AS i
    SET category = x.category
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(title text, category text)
    WHERE i.owner_id = ${ownerId}
      AND i.source = 'roadmap'
      AND i.title = x.title
      AND COALESCE(i.category, '') = ''
  `;
}

export async function loadBoard(sql: Sql, ownerId: string) {
  await seedRoadmap(sql, ownerId);
  await seedZoomNotes(sql, ownerId);
  await quiet(ingestMail(sql, ownerId));
  await quiet(syncCalendar(sql, ownerId));
  await quiet(syncDrive(sql, ownerId));
  await quiet(syncGhl(sql, ownerId));

  const items = await sql`
    SELECT id, title, area, status, priority, due, owner, source, category
    FROM items
    WHERE owner_id = ${ownerId}
      AND (snooze_until IS NULL OR snooze_until <= now())
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  const contacts = await sql`
    SELECT id, name, company, role, email, phone, area, notes, type, tier, stage, next_action, next_date, last_touch
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
  const noteCats = await sql`
    SELECT id, name, parent_id, depth FROM note_cats WHERE owner_id = ${ownerId} ORDER BY name
  `;
  const notes = await sql`
    SELECT id, cat_id, title, body, color, updated_at FROM notes WHERE owner_id = ${ownerId} ORDER BY updated_at DESC LIMIT 400
  `;
  const settings = await sql`
    SELECT runway_weeks FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1
  `;
  const calendar = await calendarMeta(sql, ownerId);

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
    needsDatabase: false,
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
        action: item.action,
      };
    }),
    plugins: await listPlugins(sql, ownerId, new Map([
      ...[...bySource.entries()].map(([key, row]) => [key, row.status] as [string, string]),
      ...(briefs[0] ? [['brief', 'connected'] as [string, string]] : []),
    ])),
    items: items.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      area: String(row.area),
      status: String(row.status),
      priority: String(row.priority),
      due: row.due ? new Date(String(row.due)).getTime() : null,
      owner: String(row.owner || ''),
      source: String(row.source || 'manual'),
      category: row.category ? String(row.category) : '',
    })),
    zoomNotes: await listZoomNotes(sql, ownerId),
    contacts: contacts.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      company: String(row.company || ''),
      role: String(row.role || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      area: String(row.area || 'other'),
      notes: String(row.notes || ''),
      type: String(row.type || 'other'),
      tier: String(row.tier || 'B'),
      stage: String(row.stage || 'new'),
      nextAction: String(row.next_action || ''),
      nextDate: row.next_date ? new Date(String(row.next_date)).getTime() : null,
      lastTouch: row.last_touch ? new Date(String(row.last_touch)).getTime() : null,
    })),
    noteCats: noteCats.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      parentId: row.parent_id ? String(row.parent_id) : null,
      depth: Number(row.depth) || 0,
    })),
    notes: notes.map((row) => ({
      id: String(row.id),
      catId: row.cat_id ? String(row.cat_id) : null,
      title: String(row.title || ''),
      body: String(row.body || ''),
      color: String(row.color || 'yellow'),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : null,
    })),
    runwayWeeks: settings[0]?.runway_weeks == null ? null : Number(settings[0].runway_weeks),
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
    events: calendar.events.map((event) => ({
      id: event.id,
      start: event.start,
      dur: event.dur,
      title: event.title,
      color: '#2E6BF2',
    })),
    calendarUntil: calendar.until,
    folders,
    drives: folders.map((folder) => ({ id: folder.id, name: folder.name, folders: folder.children, files: folder.docs })),
  };
}

