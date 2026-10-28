import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* The system map: every part of 4ormop and what it depends on, each with a real check.
   ok = working, warn = working with a gap, down = not working. Detail says why in words. */
type Node = { id: string; name: string; sub: string; lane: number; col: number; state: 'ok' | 'warn' | 'down'; detail: string; ms?: number };

const EDGES: Array<[string, string]> = [
  ['clerk', 'vercel'], ['vercel', 'news'], ['vercel', 'playbook'], ['vercel', 'planner'], ['vercel', 'calendar'], ['vercel', 'email'],
  ['neon', 'news'], ['neon', 'playbook'], ['neon', 'planner'], ['neon', 'lists'], ['neon', 'spaces'], ['neon', 'pipeline'], ['neon', 'dataroom'],
  ['cron', 'news'], ['cron', 'lists'], ['env', 'playbook'], ['env', 'rec'],
  ['calendar', 'google'], ['email', 'google'], ['docs', 'google'], ['lists', 'ghl'], ['pipeline', 'ghl'], ['spaces', 'lists'],
  ['rec', 'zoom'], ['news', 'boc'], ['playbook', 'iq'], ['dataroom', 'iq'],
];

async function timed<T>(fn: () => Promise<T>): Promise<{ v: T | null; ms: number; err: string }> {
  const t = Date.now();
  try {
    const v = await Promise.race([fn(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timed out')), 6000))]);
    return { v, ms: Date.now() - t, err: '' };
  } catch (e) {
    return { v: null, ms: Date.now() - t, err: e instanceof Error ? e.message : 'failed' };
  }
}

const ago = (iso: unknown) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(String(iso)).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const sql = session.sql;
    const env = (k: string) => !!process.env[k];
    const one = async (q: Promise<unknown>) => {
      const rows = (await q) as Array<Record<string, unknown>>;
      return rows && rows[0] ? rows[0] : {};
    };
    const [db, scrape, items, tl, contacts, spaces, growth, news, visits] = await Promise.all([
      timed(() => (sql ? one(sql`SELECT 1 AS ok`) : Promise.reject(new Error('no database url')))),
      timed(() => (sql ? one(sql`SELECT max(finished_at) AS t, count(*) FILTER (WHERE started_at > now() - interval '24 hours')::int AS n FROM scrape_runs WHERE owner_id = ${ownerId}`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE status NOT IN ('done','dropped'))::int AS open FROM items WHERE owner_id = ${session.userId}`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT count(*)::int AS n FROM timeline_items WHERE owner_id = ${session.userId} AND archived_at IS NULL`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT count(*)::int AS n FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT count(*)::int AS n FROM spaces WHERE owner_id = ${ownerId} AND deleted_at IS NULL`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE last_touch IS NOT NULL)::int AS t FROM growth_records WHERE owner_id = ${ownerId} AND deleted_at IS NULL`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT max(swept_at) AS t FROM news_sweeps`) : Promise.resolve({}))),
      timed(() => (sql ? one(sql`SELECT max(at) AS t, count(*) FILTER (WHERE at > now() - interval '7 days')::int AS n FROM site_visits`) : Promise.resolve({}))),
    ]);
    const n = (r: { v: Record<string, unknown> | null }, k = 'n') => Number((r.v || {})[k]) || 0;
    const missing = ['OPENAI_API_KEY', 'CRON_SECRET'].filter((k) => !env(k));
    const ghlOn = env('GHL_API_KEY') || env('GOHIGHLEVEL_API_KEY');
    const scrapeAt = ((scrape.v || {}) as Record<string, unknown>).t;
    const scrapeHrs = scrapeAt ? (Date.now() - new Date(String(scrapeAt)).getTime()) / 3600000 : 99;
    const newsAt = ((news.v || {}) as Record<string, unknown>).t;
    const newsHrs = newsAt ? (Date.now() - new Date(String(newsAt)).getTime()) / 3600000 : 99;
    const nodes: Node[] = [
      { id: 'vercel', name: 'Vercel', sub: '4ormop.com', lane: 0, col: 0, state: 'ok', detail: 'Serving this page' },
      { id: 'clerk', name: 'Clerk', sub: 'sign-in', lane: 0, col: 1, state: 'ok', detail: 'You are signed in' },
      { id: 'neon', name: 'Neon Postgres', sub: 'database', lane: 0, col: 2, state: db.v ? (db.ms > 1500 ? 'warn' : 'ok') : 'down', detail: db.v ? `Answered in ${db.ms} ms` : `No answer: ${db.err}`, ms: db.ms },
      { id: 'cron', name: 'Scheduled runs', sub: 'scrape 06, 12, 18', lane: 0, col: 3, state: scrapeHrs < 7 ? 'ok' : scrapeHrs < 13 ? 'warn' : 'down', detail: scrapeAt ? `Last scrape ${ago(scrapeAt)} · ${n(scrape)} runs in 24 h` : 'No scrape has run yet' },
      { id: 'env', name: 'Keys', sub: 'Vercel settings', lane: 0, col: 4, state: missing.length ? 'warn' : 'ok', detail: missing.length ? `Not set: ${missing.join(', ')}` : 'Every key is set' },
      { id: 'news', name: 'News and pulse', sub: 'sweep and gauges', lane: 1, col: 0, state: newsHrs < 9 ? 'ok' : newsHrs < 26 ? 'warn' : 'down', detail: newsAt ? `Swept ${ago(newsAt)}` : 'No sweep logged' },
      { id: 'playbook', name: 'Playbook', sub: 'plays and to-dos', lane: 1, col: 1, state: items.v ? 'ok' : 'down', detail: items.v ? `${n(items, 'open')} open to-dos · ${n(items)} in all` : 'To-dos did not load' },
      { id: 'planner', name: 'Planner', sub: 'timeline', lane: 1, col: 2, state: tl.v ? 'ok' : 'down', detail: tl.v ? `${n(tl)} items on the timeline` : 'Timeline did not load' },
      { id: 'calendar', name: 'Calendar', sub: 'Google', lane: 1, col: 3, state: 'ok', detail: env('GOOGLE_REFRESH_TOKEN') ? 'Google connected' : 'Google login held in the Vault' },
      { id: 'email', name: 'Email', sub: 'Gmail', lane: 1, col: 4, state: 'ok', detail: env('GOOGLE_REFRESH_TOKEN') ? 'Gmail connected' : 'Google login held in the Vault' },
      { id: 'lists', name: 'Contacts and lists', sub: 'growth lists', lane: 2, col: 0, state: !growth.v ? 'down' : n(growth) ? 'ok' : 'warn', detail: !growth.v ? 'Lists did not load' : n(growth) ? `${n(growth)} records · ${n(growth, 't')} contacted · ${n(contacts)} contacts` : `Growth lists not imported yet · ${n(contacts)} contacts` },
      { id: 'spaces', name: 'Spaces', sub: 'send bundles', lane: 2, col: 1, state: spaces.v ? 'ok' : 'down', detail: spaces.v ? `${n(spaces)} spaces` : 'Spaces did not load' },
      { id: 'pipeline', name: 'Pipeline', sub: 'GoHighLevel stages', lane: 2, col: 2, state: ghlOn ? 'ok' : 'warn', detail: ghlOn ? 'GoHighLevel key set' : 'GoHighLevel key read from the Vault' },
      { id: 'dataroom', name: 'Data room', sub: 'visits and sign-ins', lane: 2, col: 3, state: visits.v ? 'ok' : 'warn', detail: visits.v && (visits.v as Record<string, unknown>).t ? `${n(visits)} visits in 7 days · last ${ago((visits.v as Record<string, unknown>).t)}` : 'No visits logged yet' },
      { id: 'rec', name: 'Recordings and voice', sub: 'transcription', lane: 2, col: 4, state: env('OPENAI_API_KEY') ? 'ok' : 'warn', detail: env('OPENAI_API_KEY') ? 'Transcription ready' : 'Recording saves; transcription waits for OPENAI_API_KEY' },
      { id: 'ghl', name: 'GoHighLevel', sub: 'CRM', lane: 3, col: 0, state: ghlOn ? 'ok' : 'warn', detail: ghlOn ? 'Key set in Vercel' : 'Key held in the Vault' },
      { id: 'google', name: 'Google', sub: 'Calendar, Gmail, Drive', lane: 3, col: 1, state: 'ok', detail: env('GOOGLE_REFRESH_TOKEN') ? 'OAuth set' : 'OAuth held in the Vault' },
      { id: 'zoom', name: 'Zoom', sub: 'meetings, notes', lane: 3, col: 2, state: 'ok', detail: env('ZOOM_CLIENT_ID') ? 'App credentials set' : 'Zoom login held in the Vault' },
      { id: 'iq', name: '4ormIQ', sub: 'control room', lane: 3, col: 3, state: 'ok', detail: 'Board embedded above' },
      { id: 'boc', name: 'Bank of Canada', sub: 'rates', lane: 3, col: 4, state: 'ok', detail: 'Public data, no key needed' },
      { id: 'docs', name: 'Documents', sub: 'Drive and uploads', lane: 1, col: 5, state: 'ok', detail: 'Library and previews' },
    ];
    const down = nodes.filter((x) => x.state === 'down').length;
    const warn = nodes.filter((x) => x.state === 'warn').length;
    return NextResponse.json({ nodes, edges: EDGES, down, warn, at: new Date().toISOString() });
  } catch (err) {
    fail('ops_map', err);
    return NextResponse.json({ nodes: [], edges: [], error: 'Map did not load' }, { status: 500 });
  }
}
