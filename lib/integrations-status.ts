import { withCreds } from './creds';
import { readPipelineCache } from './changes';
import type { getSql } from './db';
import { env } from './env.mjs';
import { ghlConfigured } from './ghl';
import { googleConfigured } from './google';
import { cacheInbox } from './live';
import { syncCalendar, syncDrive, syncGhl } from './sync';
import { credSources, loadCredsFor } from './vault';
import { zoomConfigured } from './zoom';

type Sql = NonNullable<Awaited<ReturnType<typeof getSql>>>;

export type ServiceGroup = 'connected' | 'attention' | 'available';

export type ServiceRow = {
  key: string;
  name: string;
  letter: string;
  color: string;
  what: string;
  feeds: string[];
  group: ServiceGroup;
  word: string;
  detail: string;
  syncedAt: string;
  /** google = OAuth via /api/connect/google; ghl = key + location form; env = set a Vercel env var; database = connection form; none = server-run */
  connect: 'google' | 'ghl' | 'env' | 'database' | 'none';
  envVar: string;
  source: 'saved' | 'env' | 'none' | 'server';
  canDisconnect: boolean;
  canRefresh: boolean;
  why: string;
  extra: Array<{ label: string; value: string }>;
};

const SYNC_WORD: Record<string, string> = {
  connected: 'Connected',
  reached_empty: 'Connected, nothing new',
  stale: 'Stale',
  not_connected: 'Not connected',
  unavailable: 'Unavailable',
};

function ok(status: string) {
  return status === 'connected' || status === 'reached_empty';
}

function vanTime(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Vancouver',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(t));
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** One row per service, from the server's real state: sync_state, sealed credentials, env keys, caches. Never returns a secret. */
export async function integrationStatus(sql: Sql | null, userId: string): Promise<{ services: ServiceRow[]; lastSync: string }> {
  const creds = await safe(() => loadCredsFor(userId), { googleRefresh: '', ghlKey: '', ghlLocation: '' });
  const sources = await safe(() => credSources(userId), { google: 'none', ghl: 'none', database: 'none' } as const);
  const configured = await withCreds(creds, async () => ({ google: googleConfigured(), ghl: ghlConfigured() }));
  const sync = new Map<string, { status: string; detail: string; at: string }>();
  let lastSync = '';
  if (sql) {
    const rows = (await safe(() => sql`SELECT source, status, detail, synced_at FROM sync_state WHERE owner_id = ${userId}`, [])) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const at = row.synced_at ? new Date(String(row.synced_at)).toISOString() : '';
      sync.set(String(row.source), { status: String(row.status || ''), detail: String(row.detail || ''), at });
      if (at && at > lastSync) lastSync = at;
    }
  }
  const services: ServiceRow[] = [];
  const base = { envVar: '', why: '', extra: [] as Array<{ label: string; value: string }>, canDisconnect: false, canRefresh: false };

  const google = [
    { key: 'gmail', name: 'Gmail', letter: 'G', color: '#d93025', what: 'People-only inbox, the Email board, replies in your voice.', feeds: ['Dashboard inbox', 'Email', 'Contacts warmth'] },
    { key: 'calendar', name: 'Google Calendar', letter: 'C', color: '#1a73e8', what: 'Calendar page, meeting alarms, Find a slot, booking link.', feeds: ['Calendar', 'Alarms', 'Booking'] },
    { key: 'drive', name: 'Google Drive', letter: 'D', color: '#188038', what: 'Drive page, Documents, files attached to Spaces.', feeds: ['Drive', 'Documents', 'Spaces'] },
  ];
  for (const g of google) {
    const s = sync.get(g.key);
    const status = s?.status || '';
    const hasCred = configured.google;
    const group: ServiceGroup = hasCred && ok(status) ? 'connected' : hasCred ? 'attention' : 'available';
    const word = !hasCred ? 'Not connected' : SYNC_WORD[status] || 'Connected, not synced yet';
    services.push({
      ...base,
      ...g,
      group,
      word,
      detail: [s?.detail, s?.at ? `synced ${vanTime(s.at)}` : ''].filter(Boolean).join(' · '),
      syncedAt: s?.at || '',
      connect: 'google',
      source: sources.google,
      canDisconnect: sources.google === 'saved',
      canRefresh: hasCred,
      why: hasCred && !ok(status) ? 'Google is connected but the last sync did not finish. Refresh, or reconnect Google if it keeps failing.' : '',
      extra: [{ label: 'Access', value: g.key === 'gmail' ? 'read · send · modify' : 'read · write' }],
    });
  }

  const ghlSync = sync.get('ghl');
  const pipes = sql ? await safe(() => readPipelineCache(sql, userId), null) : null;
  const pipeRows = ((pipes?.pipelines || []) as Array<{ name?: string; stages?: Array<{ count?: number }> }>)
    .map((p) => ({ label: String(p.name || 'Pipeline'), value: String((p.stages || []).reduce((n, st) => n + (Number(st.count) || 0), 0)) }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  const opps = pipeRows.reduce((n, p) => n + Number(p.value), 0);
  const ghlStatus = ghlSync?.status || '';
  services.push({
    ...base,
    key: 'ghl',
    name: 'GoHighLevel',
    letter: 'G',
    color: '#f2a900',
    what: 'All pipelines, the only send rail for outreach, content queue.',
    feeds: ['Pipeline', 'Spaces send', 'Content runway'],
    group: configured.ghl && ok(ghlStatus) ? 'connected' : configured.ghl ? 'attention' : 'available',
    word: !configured.ghl ? 'Not connected' : SYNC_WORD[ghlStatus] || 'Connected, not synced yet',
    detail: pipeRows.length ? `${pipeRows.length} pipelines · ${opps} opportunities` : [ghlSync?.detail, ghlSync?.at ? `synced ${vanTime(ghlSync.at)}` : ''].filter(Boolean).join(' · '),
    syncedAt: ghlSync?.at || '',
    connect: 'ghl',
    source: sources.ghl,
    canDisconnect: sources.ghl === 'saved',
    canRefresh: configured.ghl,
    why: configured.ghl && !ok(ghlStatus) ? 'GoHighLevel did not answer on the last sync. Refresh, or check the key and location.' : '',
    extra: pipeRows,
  });

  const zoomOn = zoomConfigured();
  const zoomCount = sql
    ? Number(((await safe(() => sql`SELECT count(*)::int AS n FROM zoom_notes WHERE owner_id = ${userId} AND deleted_at IS NULL`, [])) as Array<{ n: number }>)[0]?.n || 0)
    : 0;
  const zoomAt = sql
    ? String(((await safe(() => sql`SELECT synced_at FROM zoom_syncs WHERE owner_id = ${userId} LIMIT 1`, [])) as Array<{ synced_at?: string }>)[0]?.synced_at || '')
    : '';
  const zoomIso = zoomAt ? new Date(zoomAt).toISOString() : '';
  if (zoomIso && zoomIso > lastSync) lastSync = zoomIso;
  services.push({
    ...base,
    key: 'zoom',
    name: 'Zoom',
    letter: 'Z',
    color: '#2d8cff',
    what: 'Recordings and transcripts for Zoom notes and what you owe.',
    feeds: ['Zoom notes', 'Planner commitments'],
    group: zoomOn ? 'connected' : 'available',
    word: zoomOn ? 'Connected' : 'Not connected',
    detail: [zoomCount ? `${zoomCount} meetings` : '', zoomIso ? `synced ${vanTime(zoomIso)}` : ''].filter(Boolean).join(' · '),
    syncedAt: zoomIso,
    connect: 'env',
    envVar: 'ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET',
    source: zoomOn ? 'env' : 'none',
    canRefresh: zoomOn,
  });

  const keyed = [
    { key: 'anthropic', name: 'Anthropic', letter: 'A', color: '#d97757', envVar: 'ANTHROPIC_API_KEY', what: '4orm Intelligence: CEO moves, summaries, drafts in your voice.', feeds: ['Planner', 'Email', 'Zoom'], needed: 'Without it, CEO moves, summaries and drafts fall back to plain rules.' },
    { key: 'openai', name: 'OpenAI', letter: 'O', color: '#10a37f', envVar: 'OPENAI_API_KEY', what: 'Voice-log transcription and one-line news summaries.', feeds: ['Playbook voice log', 'News'], needed: "Without it, the voice log can't transcribe and News cards show the article's own description instead of a \"why it matters\" line." },
  ];
  const synced = [
    { key: 'perplexity', name: 'Perplexity', letter: 'P', color: '#1f6f78', envVar: 'PERPLEXITY_API_KEY', what: 'Research with cited sources from News and a Space angle.', feeds: ['News', 'Spaces'], refresh: false },
  ];
  for (const k of synced) {
    const on = !!env(k.envVar);
    const s = sync.get(k.key);
    const status = s?.status || '';
    const healthy = !status || ok(status);
    services.push({
      ...base,
      key: k.key,
      name: k.name,
      letter: k.letter,
      color: k.color,
      what: k.what,
      feeds: k.feeds,
      group: on ? (healthy ? 'connected' : 'attention') : 'available',
      word: !on ? 'Not connected' : status ? SYNC_WORD[status] || 'Connected' : k.refresh ? 'Connected, not synced yet' : 'Connected, not used yet',
      detail: on ? [s?.detail || 'key set in Vercel', s?.at ? `${k.refresh ? 'synced' : 'last used'} ${vanTime(s.at)}` : ''].filter(Boolean).join(' · ') : `${k.envVar} not set`,
      syncedAt: s?.at || '',
      connect: 'env',
      envVar: k.envVar,
      source: on ? 'env' : 'none',
      canRefresh: on && k.refresh,
      why: on && !healthy ? s?.detail || `${k.name} did not answer on the last call.` : '',
    });
  }
  for (const k of keyed) {
    const on = !!env(k.envVar);
    services.push({
      ...base,
      key: k.key,
      name: k.name,
      letter: k.letter,
      color: k.color,
      what: k.what,
      feeds: k.feeds,
      group: on ? 'connected' : k.needed ? 'attention' : 'available',
      word: on ? 'Connected' : 'Not connected',
      detail: on ? 'key set in Vercel' : `${k.envVar} not set`,
      syncedAt: '',
      connect: 'env',
      envVar: k.envVar,
      source: on ? 'env' : 'none',
      why: on ? '' : k.needed,
    });
  }

  const brief = sync.get('brief');
  services.push({
    ...base,
    key: 'brief',
    name: 'Morning brief',
    letter: 'M',
    color: '#1b7bb5',
    what: 'Weekday 06:00 America/Edmonton summary of mail, calendar and pipeline.',
    feeds: ['Planner', 'Signals'],
    group: process.env.CRON_SECRET ? (brief && !ok(brief.status) ? 'attention' : 'connected') : 'attention',
    word: process.env.CRON_SECRET ? (brief ? SYNC_WORD[brief.status] || 'Scheduled' : 'Scheduled') : 'Not scheduled',
    detail: brief?.at ? `ran ${vanTime(brief.at)}` : process.env.CRON_SECRET ? 'runs on the Vercel schedule' : 'CRON_SECRET not set',
    syncedAt: brief?.at || '',
    connect: 'env',
    envVar: 'CRON_SECRET',
    source: process.env.CRON_SECRET ? 'server' : 'none',
    why: process.env.CRON_SECRET ? '' : 'Without CRON_SECRET every scheduled job answers 401, so the brief never runs.',
  });

  services.push({
    ...base,
    key: 'database',
    name: 'Database',
    letter: 'N',
    color: '#00a37a',
    what: 'Neon Postgres: every task, note, link, Space and setting.',
    feeds: ['Everything'],
    group: sql ? 'connected' : 'attention',
    word: sql ? 'Connected' : 'Not connected',
    detail: sql ? (sources.database === 'saved' ? 'connection saved here' : 'connection set in Vercel') : 'No database connection',
    syncedAt: '',
    connect: 'database',
    source: sources.database,
    why: sql ? '' : 'Nothing saves until a database is connected.',
  });

  return { services, lastSync };
}

/** Force one source to sync now. Returns the fresh status list. */
export async function refreshService(sql: Sql, userId: string, key: string) {
  const creds = await loadCredsFor(userId);
  await withCreds(creds, async () => {
    if (key === 'calendar') await syncCalendar(sql, userId, true);
    else if (key === 'drive') await syncDrive(sql, userId, true);
    else if (key === 'ghl') await syncGhl(sql, userId, true);
    else if (key === 'gmail') await cacheInbox(sql, userId, true);
    else throw new Error('unknown');
  });
}
