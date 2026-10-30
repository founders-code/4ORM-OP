import type { Sql } from './db';
import { fail } from './log';

/**
 * Claude's side of Completed (30 Oct 2026): every change made to 4ormop on a Vancouver day, read from the
 * repository's history on main. Past days are cached for good; today refreshes at most every ten minutes.
 */
const REPO = 'founders-code/4ORM-OP';
export type BuildItem = { at: string; text: string; sha: string };

let ready: Promise<void> | null = null;
function ensure(sql: Sql) {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS build_log_days (
        day date PRIMARY KEY,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        fetched_at timestamptz NOT NULL DEFAULT now()
      )`;
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

function vanToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
/** Minutes Vancouver is behind UTC at noon on that day (420 in summer time, 480 in winter). */
function vanOffset(day: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Vancouver', timeZoneName: 'shortOffset' }).formatToParts(noon).find((p) => p.type === 'timeZoneName');
  const m = String(part?.value || '').match(/GMT([+-]\d+)/);
  return m ? -Number(m[1]) * 60 : 480;
}

/** One readable line per change: first line of the message, without the preview prefix. */
function clean(msg: string) {
  return String(msg || '').split('\n')[0].replace(/^Preview:\s*/i, '').trim();
}

async function fetchDay(day: string): Promise<BuildItem[] | null> {
  const off = vanOffset(day);
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() + off * 60000);
  const end = new Date(start.getTime() + 86400000);
  const out: BuildItem[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 4; page++) {
    const url = `https://api.github.com/repos/${REPO}/commits?sha=main&per_page=100&page=${page}&since=${start.toISOString()}&until=${end.toISOString()}`;
    const r = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': '4ormop-build-log' }, cache: 'no-store' });
    if (!r.ok) return page === 1 ? null : out;
    const rows = (await r.json()) as Array<{ sha: string; commit: { message: string; committer?: { date?: string }; author?: { date?: string } }; parents?: unknown[] }>;
    for (const c of rows) {
      if ((c.parents || []).length > 1) continue;
      const text = clean(c.commit?.message);
      if (!text || /^Merge /i.test(text) || seen.has(text)) continue;
      seen.add(text);
      out.push({ at: String(c.commit?.committer?.date || c.commit?.author?.date || ''), text: text.slice(0, 400), sha: String(c.sha || '').slice(0, 7) });
    }
    if (rows.length < 100) break;
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function buildLog(sql: Sql, dayIn: string) {
  await ensure(sql);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayIn) ? dayIn : vanToday();
  const today = vanToday();
  const row = (await sql`SELECT items, fetched_at FROM build_log_days WHERE day = ${day}::date LIMIT 1`)[0] as { items?: BuildItem[]; fetched_at?: string } | undefined;
  const age = row?.fetched_at ? Date.now() - new Date(row.fetched_at).getTime() : Infinity;
  const settled = day < today && row?.fetched_at && new Date(row.fetched_at).toISOString().slice(0, 10) > day;
  if (row && (settled || age < 10 * 60000)) return { day, items: row.items || [], cached: true };
  let items: BuildItem[] | null = null;
  try {
    items = await fetchDay(day);
  } catch (err) {
    fail('build_log_fetch', err);
  }
  if (!items) return { day, items: row?.items || [], cached: true, stale: true };
  await sql`INSERT INTO build_log_days (day, items, fetched_at) VALUES (${day}::date, ${JSON.stringify(items)}::jsonb, now())
    ON CONFLICT (day) DO UPDATE SET items = EXCLUDED.items, fetched_at = now()`;
  return { day, items, cached: false };
}
