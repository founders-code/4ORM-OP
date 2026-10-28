import type { Sql } from './db';
import { integrationStatus } from './integrations-status';

/* The process map: everything that comes into 4ormop, how it arrives, where it is kept,
   where Chad sees it and what goes back out. Every box carries a lamp from a real reading.
   ok = working, warn = working with a gap, down = failing, idle = nothing has moved through it yet.
   Pages take the worst lamp of what feeds them, so a failure upstream shows all the way down. */

export type FlowState = 'ok' | 'warn' | 'down' | 'idle';
export type FlowNode = { id: string; name: string; sub: string; lane: number; state: FlowState; detail: string; routes?: string; ms?: number };

export const FLOW_LANES = ['COMES IN', 'HOW IT ARRIVES', 'KEPT AND WORKED ON', 'WHERE YOU SEE IT', 'GOES BACK OUT'];

/* [from, to]: data flows from the first box to the second. */
export const FLOW_EDGES: Array<[string, string]> = [
  // comes in -> arrives
  ['src-gmail', 'in-gmail'], ['src-gmail', 'in-live'], ['src-cal', 'in-cal'], ['src-cal', 'in-live'], ['src-drive', 'in-live'],
  ['src-zoom', 'in-zoom'], ['src-zoom', 'in-live'], ['src-ghl', 'in-ghl'], ['src-ghl', 'in-live'],
  ['src-news', 'in-scrape'], ['src-news', 'in-news'], ['src-boc', 'in-news'], ['src-iq', 'in-live'], ['src-room', 'in-visit'],
  ['src-mic', 'in-voice'], ['src-you', 'in-voice'], ['src-you', 'in-import'],
  // arrives -> kept
  ['in-gmail', 'kp-mail'], ['in-live', 'kp-mail'], ['in-live', 'kp-cal'], ['in-live', 'kp-people'], ['in-live', 'kp-docs'], ['in-live', 'kp-ops'],
  ['in-cal', 'kp-cal'], ['in-zoom', 'kp-rec'], ['in-ghl', 'kp-people'], ['in-visit', 'kp-ops'],
  ['in-scrape', 'kp-news'], ['in-scrape', 'kp-people'], ['in-news', 'kp-news'], ['in-brief', 'kp-plan'], ['in-ceo', 'kp-plan'], ['in-snap', 'kp-plan'],
  ['in-voice', 'kp-ai'], ['in-voice', 'kp-rec'], ['in-import', 'kp-people'], ['in-import', 'kp-docs'],
  // kept -> pages
  ['kp-mail', 'pg-today'], ['kp-mail', 'pg-email'], ['kp-cal', 'pg-today'], ['kp-cal', 'pg-calendar'], ['kp-plan', 'pg-today'], ['kp-plan', 'pg-playbook'], ['kp-plan', 'pg-planner'],
  ['kp-news', 'pg-news'], ['kp-people', 'pg-contacts'], ['kp-people', 'pg-lists'], ['kp-people', 'pg-pipeline'], ['kp-people', 'pg-spaces'],
  ['kp-docs', 'pg-docs'], ['kp-docs', 'pg-spaces'], ['kp-docs', 'pg-notes'], ['kp-rec', 'pg-rec'], ['kp-rec', 'pg-zoom'],
  ['kp-ai', 'pg-today'], ['kp-ai', 'pg-email'], ['kp-ai', 'pg-zoom'], ['kp-ai', 'pg-rec'], ['kp-ai', 'pg-spaces'],
  ['kp-vault', 'pg-vault'], ['kp-vault', 'pg-integrations'], ['kp-ops', 'pg-control'], ['kp-ops', 'pg-financials'], ['kp-fin', 'pg-financials'],
  // pages -> out
  ['pg-email', 'out-gmail'], ['pg-spaces', 'out-gmail'], ['pg-spaces', 'out-ghl'], ['pg-spaces', 'out-drive'], ['pg-lists', 'out-ghl'],
  ['pg-pipeline', 'out-ghl'], ['pg-contacts', 'out-ghl'], ['pg-calendar', 'out-cal'], ['pg-calendar', 'out-zoom'], ['pg-docs', 'out-drive'],
];

type Row = Record<string, unknown>;
const hrs = (iso: unknown) => (iso ? (Date.now() - new Date(String(iso)).getTime()) / 3600000 : Infinity);
const ago = (iso: unknown) => {
  if (!iso) return 'never';
  const m = Math.max(0, Math.round((Date.now() - new Date(String(iso)).getTime()) / 60000));
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const fresh = (iso: unknown, okH: number, warnH: number): FlowState => (iso == null ? 'idle' : hrs(iso) <= okH ? 'ok' : hrs(iso) <= warnH ? 'warn' : 'down');
const rank: Record<FlowState, number> = { ok: 0, idle: 1, warn: 2, down: 3 };
const worst = (...s: FlowState[]) => s.reduce((a, b) => (rank[b] > rank[a] ? b : a), 'ok' as FlowState);

async function first(p: Promise<unknown>): Promise<Row | null> {
  try {
    const rows = (await Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 6000))])) as Row[];
    return rows && rows[0] ? rows[0] : {};
  } catch {
    return null;
  }
}

export async function buildFlowMap(sql: Sql | null, ownerId: string, userId: string) {
  const ids = [ownerId, userId];
  const t0 = Date.now();
  const none = Promise.resolve([] as Row[]);
  const Q = (fn: () => Promise<unknown>) => (sql ? first(fn()) : first(none));
  const [db, api, sync, watch, scrape, news, brief, ceo, snap, rec, voice, visits, growth, contacts, items, tl, docs, vault, fin, mail, cal, zoomSync, sched, events] = await Promise.all([
    Q(() => sql!`SELECT 1 AS ok`),
    sql ? sql`SELECT api, count(*)::int AS n, count(*) FILTER (WHERE code = 0 OR code >= 400)::int AS bad, max(at) AS last, max(at) FILTER (WHERE code = 0 OR code >= 400) AS lastbad,
        (array_agg(ms ORDER BY at DESC))[1] AS ms FROM api_calls WHERE at > now() - interval '24 hours' GROUP BY api`.catch(() => [] as Row[]) : none,
    sql ? sql`SELECT source, status, detail, synced_at FROM sync_state WHERE owner_id = ANY(${ids})`.catch(() => [] as Row[]) : none,
    sql ? sql`SELECT source, expiration FROM watch_channels WHERE owner_id = ANY(${ids})`.catch(() => [] as Row[]) : none,
    Q(() => sql!`SELECT max(finished_at) AS t, count(*) FILTER (WHERE started_at > now() - interval '24 hours')::int AS n,
        count(*) FILTER (WHERE started_at > now() - interval '24 hours' AND status NOT IN ('done','ok','running'))::int AS bad FROM scrape_runs WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT max(swept_at) AS t FROM news_sweeps`),
    Q(() => sql!`SELECT max(created_at) AS t FROM daily_brief WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT max(created_at) AS t, count(*) FILTER (WHERE status = 'open')::int AS open FROM ceo_moves WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT max(created_at) AS t FROM daily_snapshots WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*)::int AS n, max(created_at) AS t, count(*) FILTER (WHERE status IN ('failed','error'))::int AS bad FROM recordings WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*)::int AS n, max(created_at) AS t FROM voice_logs WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*) FILTER (WHERE at > now() - interval '7 days')::int AS n, max(at) AS t FROM site_visits`),
    Q(() => sql!`SELECT count(*)::int AS n, count(*) FILTER (WHERE last_touch IS NOT NULL)::int AS t, max(updated_at) AS u FROM growth_records WHERE owner_id = ANY(${ids}) AND deleted_at IS NULL`),
    Q(() => sql!`SELECT count(*)::int AS n FROM contacts WHERE owner_id = ANY(${ids}) AND deleted_at IS NULL`),
    Q(() => sql!`SELECT count(*) FILTER (WHERE status NOT IN ('done','dropped'))::int AS open, count(*)::int AS n FROM items WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*)::int AS n FROM timeline_items WHERE owner_id = ANY(${ids}) AND archived_at IS NULL`),
    Q(() => sql!`SELECT count(*)::int AS n FROM documents WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*)::int AS n FROM vault_docs`),
    Q(() => sql!`SELECT count(*)::int AS n FROM saas_expenses WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT max(fetched_at) AS t FROM inbox_cache WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT max(fetched_at) AS t FROM calendar_cache WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT max(synced_at) AS t FROM zoom_syncs WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*) FILTER (WHERE status = 'failed')::int AS bad, count(*) FILTER (WHERE status = 'sent' AND send_at > now() - interval '7 days')::int AS sent FROM scheduled_mail WHERE owner_id = ANY(${ids})`),
    Q(() => sql!`SELECT count(*) FILTER (WHERE level = 'err' AND at > now() - interval '24 hours')::int AS bad FROM ops_events`),
  ]);
  const dbMs = Date.now() - t0;
  const svc = sql ? await integrationStatus(sql, userId).catch(() => ({ services: [] as Array<{ key: string; group: string; word: string; detail: string }> })) : { services: [] };
  const S = (k: string) => (svc.services as Array<{ key: string; group: string; word: string; detail: string }>).find((s) => s.key === k);
  const A = new Map<string, Row>(((api as Row[]) || []).map((r) => [String(r.api), r]));
  const Y = new Map<string, Row>(((sync as Row[]) || []).map((r) => [String(r.source), r]));
  const W = new Map<string, Row>(((watch as Row[]) || []).map((r) => [String(r.source), r]));
  const n = (r: Row | null, k = 'n') => Number((r || {})[k]) || 0;

  /* An outside service: connected or not, then how its calls did in the last 24 hours. */
  const service = (key: string, apiKey: string, connectedKey = key): { state: FlowState; detail: string; ms?: number } => {
    const s = S(connectedKey);
    const a = A.get(apiKey);
    const calls = n(a || null);
    const bad = n(a || null, 'bad');
    const callTxt = calls ? `${calls} calls in 24 h${bad ? `, ${bad} failed (last ${ago(a?.lastbad)})` : ', none failed'}` : 'no calls in 24 h';
    let state: FlowState = calls ? (bad === 0 ? 'ok' : bad / calls > 0.3 && bad >= 3 ? 'down' : 'warn') : 'idle';
    if (s && s.group === 'available') state = 'idle';
    if (s && s.group === 'attention') state = worst(state, 'warn');
    const conn = s ? `${s.word}${s.detail ? ` · ${s.detail}` : ''}` : '';
    return { state, detail: [conn, callTxt].filter(Boolean).join(' · '), ms: a?.ms == null ? undefined : Number(a.ms) };
  };
  const syncOf = (source: string, okH: number, warnH: number): { state: FlowState; detail: string } => {
    const r = Y.get(source);
    if (!r) return { state: 'idle', detail: 'Not synced yet' };
    const st = String(r.status || '');
    const good = st === 'connected' || st === 'reached_empty';
    const state = st === 'not_connected' ? 'idle' : !good ? (st === 'stale' ? 'warn' : 'down') : fresh(r.synced_at, okH, warnH);
    return { state, detail: `${String(r.detail || st)} · synced ${ago(r.synced_at)}` };
  };
  const watchOf = (source: string): { state: FlowState; detail: string } => {
    const w = W.get(source);
    if (!w) return { state: 'idle', detail: 'Push not set up yet; the 5-minute live sync covers it' };
    const left = w.expiration ? (new Date(String(w.expiration)).getTime() - Date.now()) / 3600000 : -1;
    return left > 12 ? { state: 'ok', detail: `Push channel open, renews in ${Math.round(left)} h` }
      : left > 0 ? { state: 'warn', detail: `Push channel expires in ${Math.round(left)} h` }
        : { state: 'warn', detail: 'Push channel expired; the 5-minute live sync still covers it' };
  };

  const g = service('gmail', 'google', 'gmail');
  const c = service('calendar', 'google', 'calendar');
  const d = service('drive', 'google', 'drive');
  const ghl = service('ghl', 'ghl');
  const zoom = service('zoom', 'zoom');
  const oai = service('openai', 'openai');
  const ant = service('anthropic', 'anthropic');
  const ppx = service('perplexity', 'perplexity');
  const boc = A.get('boc') ? service('boc', 'boc') : { state: 'idle' as FlowState, detail: 'No rate pulls in 24 h' };
  const iq = A.get('iq') ? service('iq', 'iq') : { state: 'idle' as FlowState, detail: 'No reads from 4ormIQ in 24 h' };
  const scrapeState = fresh((scrape || {}).t, 7, 13);
  const newsState = fresh((news || {}).t, 9, 26);

  const nodes: FlowNode[] = [
    { id: 'src-gmail', lane: 0, name: 'Gmail', sub: 'inbox, LinkedIn alerts', ...g },
    { id: 'src-cal', lane: 0, name: 'Google Calendar', sub: 'events, invites', ...c },
    { id: 'src-drive', lane: 0, name: 'Google Drive', sub: 'files, folders', ...d },
    { id: 'src-zoom', lane: 0, name: 'Zoom', sub: 'meetings, notes', ...zoom },
    { id: 'src-ghl', lane: 0, name: 'GoHighLevel', sub: 'contacts, pipelines', ...ghl },
    { id: 'src-news', lane: 0, name: 'News sites', sub: 'regulators, trade press', state: worst(scrapeState, newsState), detail: `Read ${ago((news || {}).t)}` },
    { id: 'src-boc', lane: 0, name: 'Bank of Canada', sub: 'policy rate', ...boc },
    { id: 'src-iq', lane: 0, name: '4ormIQ', sub: 'control room numbers', ...iq },
    { id: 'src-room', lane: 0, name: 'Data room', sub: 'page views', state: (visits || {}).t ? fresh((visits || {}).t, 24 * 7, 24 * 30) : 'idle', detail: `${n(visits)} visits in 7 days · last ${ago((visits || {}).t)}` },
    { id: 'src-mic', lane: 0, name: 'Microphone', sub: 'calls, voice notes', state: rec ? (n(rec) ? 'ok' : 'idle') : 'down', detail: `${n(rec)} recordings · last ${ago((rec || {}).t)}` },
    { id: 'src-you', lane: 0, name: 'You', sub: 'typing, uploads', state: 'ok', detail: 'Signed in' },

    { id: 'in-gmail', lane: 1, name: 'Gmail push', sub: '/api/hooks/gmail', routes: '/api/hooks/gmail', ...watchOf('gmail') },
    { id: 'in-cal', lane: 1, name: 'Calendar push', sub: '/api/hooks/calendar', routes: '/api/hooks/calendar', ...watchOf('calendar') },
    { id: 'in-zoom', lane: 1, name: 'Zoom webhook', sub: '/api/hooks/zoom', routes: '/api/hooks/zoom', state: (zoomSync || {}).t ? fresh((zoomSync || {}).t, 26, 72) : 'idle', detail: `Zoom synced ${ago((zoomSync || {}).t)}` },
    { id: 'in-ghl', lane: 1, name: 'GoHighLevel webhook', sub: '/api/hooks/ghl', routes: '/api/hooks/ghl', ...syncOf('ghl', 1, 24) },
    { id: 'in-live', lane: 1, name: 'Live sync', sub: 'every 5 min', routes: '/api/cron/live', state: (mail || {}).t ? fresh((mail || {}).t, 1.5, 6) : 'idle', detail: `Inbox read ${ago((mail || {}).t)}; pushes and history in between` },
    { id: 'in-scrape', lane: 1, name: 'Scrape', sub: '06:00, 12:00, 18:00', routes: '/api/cron/scrape', state: n(scrape, 'bad') ? worst(scrapeState, 'warn') : scrapeState, detail: `Last run ${ago((scrape || {}).t)} · ${n(scrape)} runs in 24 h${n(scrape, 'bad') ? `, ${n(scrape, 'bad')} did not finish` : ''}` },
    { id: 'in-news', lane: 1, name: 'News sweep, pulse', sub: 'several times a day', routes: '/api/cron/news, /api/cron/pulse', state: newsState, detail: `Swept ${ago((news || {}).t)}` },
    { id: 'in-brief', lane: 1, name: 'Morning brief', sub: 'weekdays 05:00', routes: '/api/cron/brief', state: fresh((brief || {}).t, 30, 80), detail: `Written ${ago((brief || {}).t)}` },
    { id: 'in-ceo', lane: 1, name: 'CEO score', sub: 'daily', routes: '/api/cron/ceo', state: fresh((ceo || {}).t, 30, 80), detail: `${n(ceo, 'open')} open moves · scored ${ago((ceo || {}).t)}` },
    { id: 'in-snap', lane: 1, name: 'Daily snapshot', sub: 'end of day', routes: '/api/cron/snapshot', state: fresh((snap || {}).t, 30, 80), detail: `Saved ${ago((snap || {}).t)}` },
    { id: 'in-visit', lane: 1, name: 'Visit beacon', sub: '/api/hooks/visit', routes: '/api/hooks/visit', state: (visits || {}).t ? 'ok' : 'idle', detail: `Last visit ${ago((visits || {}).t)}` },
    { id: 'in-voice', lane: 1, name: 'Recorder, voice', sub: 'record and transcribe', routes: '/api/recordings, /api/voice', state: n(rec, 'bad') ? 'warn' : (rec ? 'ok' : 'down'), detail: `${n(voice)} voice notes · ${n(rec)} recordings${n(rec, 'bad') ? ` · ${n(rec, 'bad')} failed` : ''}` },
    { id: 'in-import', lane: 1, name: 'Imports', sub: 'CSV, .4orm, uploads', routes: '/api/growth, /api/reach-out, /api/documents/upload', state: growth ? 'ok' : 'down', detail: `${n(growth)} list records loaded` },

    { id: 'kp-mail', lane: 2, name: 'Mail store', sub: 'inbox cache', state: (mail || {}).t ? fresh((mail || {}).t, 1.5, 12) : 'idle', detail: `Inbox cached ${ago((mail || {}).t)}` },
    { id: 'kp-cal', lane: 2, name: 'Calendar store', sub: 'event cache', state: (cal || {}).t ? fresh((cal || {}).t, 1, 12) : 'idle', detail: `Events cached ${ago((cal || {}).t)}` },
    { id: 'kp-people', lane: 2, name: 'People and lists', sub: 'contacts, growth, calls', state: growth && contacts ? 'ok' : 'down', detail: `${n(contacts)} contacts · ${n(growth)} list records · ${n(growth, 't')} contacted` },
    { id: 'kp-plan', lane: 2, name: 'Plans and to-dos', sub: 'items, timeline', state: items && tl ? 'ok' : 'down', detail: `${n(items, 'open')} open to-dos · ${n(tl)} timeline items` },
    { id: 'kp-news', lane: 2, name: 'News store', sub: 'items, pulse', state: newsState, detail: `Swept ${ago((news || {}).t)}` },
    { id: 'kp-rec', lane: 2, name: 'Recordings store', sub: 'audio, transcripts', state: rec ? (n(rec, 'bad') ? 'warn' : 'ok') : 'down', detail: `${n(rec)} recordings` },
    { id: 'kp-docs', lane: 2, name: 'Documents', sub: 'Drive cache, uploads', state: docs ? 'ok' : 'warn', detail: `${n(docs)} documents` },
    { id: 'kp-ai', lane: 2, name: 'AI', sub: 'OpenAI, Anthropic, Perplexity', state: worst(oai.state === 'idle' ? 'warn' : oai.state, ant.state === 'down' ? 'down' : 'ok', ppx.state === 'down' ? 'down' : 'ok'), detail: `OpenAI: ${oai.detail} | Anthropic: ${ant.detail} | Perplexity: ${ppx.detail}` },
    { id: 'kp-vault', lane: 2, name: 'Vault', sub: 'keys, audits, registers', state: vault ? 'ok' : 'down', detail: `${n(vault)} documents · logins sealed` },
    { id: 'kp-fin', lane: 2, name: 'Finance', sub: 'figures, SaaS bills', state: fin ? 'ok' : 'warn', detail: `${n(fin)} recurring bills tracked` },
    { id: 'kp-ops', lane: 2, name: 'Ops log', sub: 'API calls, events', state: n(events, 'bad') > 20 ? 'warn' : 'ok', detail: `${n(events, 'bad')} errors logged in 24 h` },
    { id: 'kp-db', lane: 2, name: 'Neon Postgres', sub: 'holds every store', state: db ? (dbMs > 2500 ? 'warn' : 'ok') : 'down', detail: db ? `Answered all ${24} reads in ${dbMs} ms` : 'Database did not answer', ms: dbMs },

    { id: 'pg-today', lane: 3, name: 'Today', sub: 'brief, CEO chat', state: 'ok', detail: '' },
    { id: 'pg-news', lane: 3, name: 'News', sub: 'gauges, releases', state: 'ok', detail: '' },
    { id: 'pg-playbook', lane: 3, name: 'Playbook', sub: 'plays, to-dos', state: 'ok', detail: '' },
    { id: 'pg-planner', lane: 3, name: 'Planner', sub: 'timeline', state: 'ok', detail: '' },
    { id: 'pg-calendar', lane: 3, name: 'Calendar', sub: 'events, slots', state: 'ok', detail: '' },
    { id: 'pg-email', lane: 3, name: 'Email', sub: 'inbox, write', state: 'ok', detail: '' },
    { id: 'pg-contacts', lane: 3, name: 'Contacts', sub: 'everyone', state: 'ok', detail: '' },
    { id: 'pg-lists', lane: 3, name: 'Lists', sub: 'call lists', state: 'ok', detail: '' },
    { id: 'pg-spaces', lane: 3, name: 'Spaces', sub: 'send bundles', state: 'ok', detail: '' },
    { id: 'pg-pipeline', lane: 3, name: 'Pipeline', sub: 'GoHighLevel stages', state: 'ok', detail: '' },
    { id: 'pg-notes', lane: 3, name: 'Links, Notes', sub: 'library', state: 'ok', detail: '' },
    { id: 'pg-docs', lane: 3, name: 'Documents', sub: 'files', state: 'ok', detail: '' },
    { id: 'pg-rec', lane: 3, name: 'Recordings', sub: 'audio, search', state: 'ok', detail: '' },
    { id: 'pg-zoom', lane: 3, name: 'Zoom', sub: 'meetings, ask', state: 'ok', detail: '' },
    { id: 'pg-financials', lane: 3, name: 'Financials', sub: 'figures, spend', state: 'ok', detail: '' },
    { id: 'pg-vault', lane: 3, name: 'Vault', sub: 'audits, registers', state: 'ok', detail: '' },
    { id: 'pg-integrations', lane: 3, name: 'Integrations', sub: 'connections', state: 'ok', detail: '' },
    { id: 'pg-control', lane: 3, name: 'Control room', sub: 'this map', state: 'ok', detail: '' },

    { id: 'out-gmail', lane: 4, name: 'Gmail send', sub: 'replies, scheduled', state: n(sched, 'bad') ? 'warn' : g.state === 'down' ? 'down' : n(sched, 'sent') ? 'ok' : 'idle', detail: `${n(sched, 'sent')} scheduled sends in 7 days${n(sched, 'bad') ? ` · ${n(sched, 'bad')} failed` : ''}` },
    { id: 'out-ghl', lane: 4, name: 'GoHighLevel', sub: 'stage moves, emails, tags', state: ghl.state, detail: ghl.detail },
    { id: 'out-cal', lane: 4, name: 'Calendar invites', sub: 'new events', state: c.state, detail: c.detail },
    { id: 'out-zoom', lane: 4, name: 'Zoom meetings', sub: '+ 4orm Zoom', state: zoom.state, detail: zoom.detail },
    { id: 'out-drive', lane: 4, name: 'Drive files', sub: 'moves, uploads', state: d.state, detail: d.detail },
  ];

  /* Every store sits in the database: when it is down, they all are. Pages take the worst of what feeds them. */
  const byId = new Map(nodes.map((x) => [x.id, x]));
  const dbNode = byId.get('kp-db')!;
  if (dbNode.state === 'down') for (const x of nodes) if (x.lane === 2 && x.id !== 'kp-ai') { x.state = 'down'; x.detail = `Database did not answer · ${x.detail}`; }
  for (const p of nodes.filter((x) => x.lane === 3)) {
    const feeds = FLOW_EDGES.filter((e) => e[1] === p.id).map((e) => byId.get(e[0])).filter(Boolean) as FlowNode[];
    const bad = feeds.filter((f) => f.state === 'down' || f.state === 'warn');
    p.state = feeds.length ? feeds.map((f) => (f.state === 'idle' ? 'ok' : f.state)).reduce((a, b) => worst(a, b), 'ok' as FlowState) : 'ok';
    p.detail = `Fed by ${feeds.map((f) => f.name).join(', ')}${bad.length ? ` · check ${bad.map((f) => f.name).join(', ')}` : ''}`;
  }
  return {
    lanes: FLOW_LANES,
    nodes,
    edges: FLOW_EDGES,
    down: nodes.filter((x) => x.state === 'down').length,
    warn: nodes.filter((x) => x.state === 'warn').length,
    idle: nodes.filter((x) => x.state === 'idle').length,
    at: new Date().toISOString(),
  };
}
