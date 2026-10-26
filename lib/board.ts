import type { NeonQueryFunction } from '@neondatabase/serverless';
import { ROADMAP } from './roadmap.mjs';
import { idlePlugins, listPlugins } from './plugins';
import { listZoomNotes, seedZoomNotes } from './zoom-notes';
import { fail } from './log';
import { seedFacebook } from './seed-facebook';
import { seedOps } from './seed-ops';
import { syncDrive, calendarMeta } from './sync';

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

function asNest(value: unknown): Record<string, string[]> {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, kids]) => {
    const name = String(key || '').trim();
    if (!name) return;
    out[name] = asList(kids).map((item) => String(item || '').trim()).filter(Boolean);
  });
  return out;
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
  { source: 'gmail', nm: 'Gmail', feeds: 'Mail that becomes tasks, drafts for packages', color: '#D6334E', ic: '@', scopes: 'read · send · modify', action: 'google' },
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
  docs: { id: string; name: string; url: string; kind: string; mime: string; thumb: string }[];
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
          mime: String(file.mime || ''),
          thumb: String(file.thumb || ''),
        }))
      : [],
    children: asFolders(node.children as Array<Record<string, unknown>> | undefined)
      .concat(asFolders(node.folders as Array<Record<string, unknown>> | undefined)),
  }));
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
    resolvedWaiting: [],
    reads: { database: needsDatabase ? 'failed' : 'ok' },
  };
}

type Row = Record<string, unknown>;

function edmontonDay(value: unknown) {
  if (value == null || value === '') return '';
  const ms = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function deskBrief(items: Row[], contacts: Row[]) {
  const today = edmontonDay(new Date());
  const open = items.filter((row) => row.status !== 'done' && row.status !== 'dropped');
  const late = open.filter((row) => {
    const day = edmontonDay(row.due);
    return !!day && day < today;
  });
  const due = open.filter((row) => edmontonDay(row.due) === today);
  const waiting = contacts.filter((row) => {
    const day = edmontonDay(row.next_date);
    const stage = String(row.stage || '');
    return !!day && day <= today && stage !== 'lost' && stage !== 'committed';
  });
  const lines = [
    ...late.map((row) => `Overdue - ${String(row.title || '')}`),
    ...due.map((row) => `Due today - ${String(row.title || '')}`),
    ...waiting.map((row) => `${String(row.name || 'Someone')} is waiting`),
  ].filter((line) => line.trim().length > 2);
  if (!lines.length) return { headline: 'Nothing urgent on the desk', summary: '', top3: [] as Array<{ t: string }> };
  const bits: string[] = [];
  if (late.length) bits.push(`${late.length} overdue`);
  if (due.length) bits.push(`${due.length} due today`);
  if (waiting.length) bits.push(`${waiting.length} waiting on you`);
  return { headline: lines[0], summary: bits.join(' - '), top3: lines.slice(0, 8).map((t) => ({ t })) };
}

async function read<T>(reads: Record<string, 'ok' | 'failed'>, name: string, job: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const value = await job();
    reads[name] = 'ok';
    return value;
  } catch (err) {
    fail(`board_${name}`, err);
    reads[name] = 'failed';
    return fallback;
  }
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
  const reads: Record<string, 'ok' | 'failed'> = {};
  await read(reads, 'roadmap', () => seedRoadmap(sql, ownerId), undefined);
  await read(reads, 'zoomSeed', () => seedZoomNotes(sql, ownerId), undefined);
  await read(reads, 'driveSync', () => syncDrive(sql, ownerId), undefined);

  const items = await read(reads, 'items', async () => {
    const rows = await sql`
      SELECT id, title, area, status, priority, due, owner, source, category, notes, updated_at, to_jsonb(items) ->> 'position' AS position
      FROM items
      WHERE owner_id = ${ownerId}
        AND status <> 'dropped'
        AND (snooze_until IS NULL OR snooze_until <= now())
      ORDER BY updated_at DESC
      LIMIT 200
    `;
    return rows as Row[];
  }, []);
  await read(reads, 'facebook', () => seedFacebook(sql, ownerId), undefined);
  await read(reads, 'ops_seed', () => seedOps(sql, ownerId), undefined);
  const contacts = await read(reads, 'contacts', async () => {
    const rows = await sql`
      SELECT id, name, company, role, email, phone, area, notes, type, tier, stage, next_action, next_date, last_touch
        FROM contacts
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY name
      LIMIT 400
    `;
    const tagged = new Map<string, string>();
    const extraById = new Map<string, Row>();
    try {
      const extra = await sql`
        SELECT id, category, fb_tier, fb_ask, fb_status, mutuals, what_they_do, fb_why, source
        FROM contacts WHERE owner_id = ${ownerId}
      `;
      for (const row of extra as Row[]) extraById.set(String(row.id), row);
    } catch (err) {
      fail('board_contact_category', err);
      try {
        const extra = await sql`SELECT id, category FROM contacts WHERE owner_id = ${ownerId}`;
        for (const row of extra as Row[]) extraById.set(String(row.id), row);
      } catch (inner) {
        fail('board_contact_category', inner);
      }
    }
    return (rows as Row[]).map((row) => {
      const extra = extraById.get(String(row.id)) || {};
      return {
        ...row,
        category: extra.category ? String(extra.category) : '',
        fbTier: extra.fb_tier ? String(extra.fb_tier) : '',
        fbAsk: extra.fb_ask ? String(extra.fb_ask) : '',
        fbStatus: extra.fb_status ? String(extra.fb_status) : '',
        mutuals: extra.mutuals ? String(extra.mutuals) : '',
        whatTheyDo: extra.what_they_do ? String(extra.what_they_do) : '',
        fbWhy: extra.fb_why ? String(extra.fb_why) : '',
        source: extra.source ? String(extra.source) : '',
      };
    }) as Row[];
  }, []);
  const categories = await read(reads, 'categories', async () => {
    const rows = await sql`SELECT id, name, subs, nest, position FROM link_categories WHERE owner_id = ${ownerId} AND COALESCE(to_jsonb(link_categories) ->> 'deleted_at', '') = '' ORDER BY position ASC, name`;
    return rows as Row[];
  }, []);
  const links = await read(reads, 'links', async () => {
    const rows = await sql`
      SELECT id, title, url, category, sub, note, leaf FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200
    `;
    return rows as Row[];
  }, []);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const briefs = await read(reads, 'brief', async () => {
    const rows = await sql`
      SELECT headline, summary, top_three
      FROM daily_brief
      WHERE owner_id = ${ownerId} AND brief_date = ${today}
    `;
    return rows as Row[];
  }, []);
  const stages = await read(reads, 'pipeline', async () => {
    const rows = await sql`SELECT stage, count, detail FROM pipeline_stages WHERE owner_id = ${ownerId} ORDER BY stage`;
    return rows as Row[];
  }, []);
  const states = await read(reads, 'integrations', async () => {
    const rows = await sql`SELECT source, status, detail, synced_at FROM sync_state WHERE owner_id = ${ownerId}`;
    return rows as Row[];
  }, []);
  const cached = await read(reads, 'drives', async () => {
    const rows = await sql`SELECT tree FROM drive_cache WHERE owner_id = ${ownerId}`;
    return rows as Row[];
  }, []);
  const noteCats = await read(reads, 'noteCats', async () => {
    const rows = await sql`SELECT id, name, parent_id, depth FROM note_cats WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY name`;
    return rows as Row[];
  }, []);
  const notes = await read(reads, 'notes', async () => {
    const rows = await sql`
      SELECT id, cat_id, title, body, color, pinned, updated_at FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 400
    `;
    return rows as Row[];
  }, []);
  const settings = await read(reads, 'settings', async () => {
    const rows = await sql`SELECT runway_weeks FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
    return rows as Row[];
  }, []);
  const resolvedWaiting = await read(reads, 'resolvedWaiting', async () => {
    const rows = await sql`SELECT source_key FROM resolved_waiting WHERE owner_id = ${ownerId}`;
    return (rows as Row[]).map((row) => String(row.source_key || '')).filter(Boolean);
  }, []);
  const calendar = await read(reads, 'events', () => calendarMeta(sql, ownerId), { events: [], until: null });
  const zoomNotes = await read(reads, 'zoomNotes', () => listZoomNotes(sql, ownerId), []);

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

  const brief = deskBrief(items, contacts);

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
          mime: String(file.mime || ''),
          thumb: String(file.thumb || ''),
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
    plugins: await read(reads, 'plugins', () => listPlugins(sql, ownerId, new Map([
      ...[...bySource.entries()].map(([key, row]) => [key, row.status] as [string, string]),
      ...(briefs[0] ? [['brief', 'connected'] as [string, string]] : []),
    ])), idlePlugins()),
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
      waitingOn: '',
      planOf: '',
      position: row.position == null || row.position === '' ? null : Number(row.position),
    })),
    zoomNotes,
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
      category: row.category ? String(row.category) : '',
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
      pin: !!row.pinned,
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : null,
    })),
    runwayWeeks: settings[0]?.runway_weeks == null ? null : Number(settings[0].runway_weeks),
    categories: categories.map((row) => ({
      id: String(row.id || ''),
      name: String(row.name),
      subs: asList(row.subs).map(String),
      nest: asNest(row.nest),
    })),
    links: links.map((row) => ({
      id: String(row.id || ''),
      title: String(row.title),
      url: String(row.url),
      cat: String(row.category || ''),
      sub: String(row.sub || ''),
      leaf: String(row.leaf || ''),
      note: String(row.note || ''),
    })),
    events: calendar.events.map((event) => ({
      id: event.id,
      start: event.start,
      dur: event.dur,
      title: event.title,
      color: '#2E6BF2',
      join: String((event as { join?: string }).join || ''),
    })),
    calendarUntil: calendar.until,
    folders,
    drives: folders.map((folder) => ({ id: folder.id, name: folder.name, folders: folder.children, files: folder.docs })),
    resolvedWaiting,
    reads: { ...reads, folders: reads.drives || 'failed' },
  };
}

