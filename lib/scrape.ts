import type { Sql } from './db';
import { fail } from './log';
import { buildPulse, savePulse } from './news-pulse';
import { ensureNewsTables, runNewsSweep } from './news-sweep';
import { buildCallLists } from './reach-lists';

/* The scrape runs three times a day, at 06:00, 12:00 and 18:00 Vancouver time.
   Each run sweeps the news, rebuilds the market pulse and refreshes the call lists, and every run is logged
   so the Control room can show the audit and raise an alert when a slot is missed. */
export const SCRAPE_HOURS = [6, 12, 18];

function vanParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || '00';
  return { day: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')), minute: Number(g('minute')) };
}

export function scrapeSlot(d = new Date()) {
  const v = vanParts(d);
  if (!SCRAPE_HOURS.includes(v.hour)) return null;
  return `${v.day} ${String(v.hour).padStart(2, '0')}:00`;
}

export async function ensureScrapeTable(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS scrape_runs (
    id bigserial PRIMARY KEY,
    owner_id text NOT NULL,
    slot text NOT NULL,
    trigger text NOT NULL DEFAULT 'cron',
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running',
    news_saved int NOT NULL DEFAULT 0,
    lists int NOT NULL DEFAULT 0,
    people int NOT NULL DEFAULT 0,
    detail text NOT NULL DEFAULT ''
  )`;
  await sql`CREATE INDEX IF NOT EXISTS scrape_runs_owner_slot ON scrape_runs (owner_id, slot)`;
}

export async function runScrape(sql: Sql, ownerId: string, slot: string, trigger: string, budgetMs = 45000) {
  await ensureScrapeTable(sql);
  const row = await sql`INSERT INTO scrape_runs (owner_id, slot, trigger) VALUES (${ownerId}, ${slot}, ${trigger}) RETURNING id`;
  const id = Number(row[0]?.id);
  const notes: string[] = [];
  let saved = 0;
  let lists = 0;
  let people = 0;
  let ok = true;
  const t0 = Date.now();
  try {
    await ensureNewsTables(sql).catch(() => {});
    const r = await runNewsSweep(sql, ownerId, Math.max(8000, budgetMs - 15000));
    saved = Number(r.saved) || 0;
    notes.push(`news ${saved}`);
  } catch (err) {
    ok = false;
    notes.push('news failed');
    fail('scrape_news', err);
  }
  try {
    await savePulse(sql, ownerId, 'market', await buildPulse(sql, ownerId, 'market'));
    await savePulse(sql, ownerId, 'consumer', await buildPulse(sql, ownerId, 'consumer'));
    notes.push('pulse rebuilt');
  } catch (err) {
    ok = false;
    notes.push('pulse failed');
    fail('scrape_pulse', err);
  }
  if (Date.now() - t0 < budgetMs - 8000) {
    try {
      const built = await buildCallLists(sql, ownerId, ownerId);
      lists = built.length;
      people = built.reduce((a, l) => a + (l.people || []).length, 0);
      notes.push(`lists ${lists} (${people} people)`);
    } catch (err) {
      ok = false;
      notes.push('lists failed');
      fail('scrape_lists', err);
    }
  } else {
    notes.push('lists skipped (time)');
  }
  await sql`UPDATE scrape_runs SET finished_at = now(), status = ${ok ? 'ok' : 'partial'}, news_saved = ${saved}, lists = ${lists},
    people = ${people}, detail = ${notes.join(' · ')} WHERE id = ${id}`;
  return { id, ok, saved, lists, people, detail: notes.join(' · ') };
}

/** Last N days of slots: expected 3 a day. Missed = slot passed by 30 minutes with no finished run. */
export async function scrapeAudit(sql: Sql, ownerId: string, days = 7) {
  await ensureScrapeTable(sql);
  const rows = (await sql`SELECT slot, trigger, started_at, finished_at, status, news_saved, lists, people, detail
    FROM scrape_runs WHERE owner_id = ${ownerId} AND started_at > now() - (${days + 1} || ' days')::interval
    ORDER BY started_at DESC LIMIT 200`) as Array<Record<string, unknown>>;
  const bySlot = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const k = String(r.slot);
    const prev = bySlot.get(k);
    if (!prev || (prev.status !== 'ok' && r.status === 'ok')) bySlot.set(k, r);
  }
  const first = (await sql`SELECT min(slot) AS s FROM scrape_runs WHERE owner_id = ${ownerId}`)[0]?.s;
  const since = first ? String(first) : '9999';
  const now = new Date();
  const out: Array<{ slot: string; day: string; hour: number; state: 'ok' | 'partial' | 'missed' | 'running' | 'upcoming'; at: string; detail: string }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const day = vanParts(d).day;
    for (const h of SCRAPE_HOURS) {
      const slot = `${day} ${String(h).padStart(2, '0')}:00`;
      if (slot < since) continue;
      const r = bySlot.get(slot);
      const v = vanParts(now);
      const slotMinutes = h * 60;
      const nowMinutes = v.hour * 60 + v.minute;
      const isToday = day === v.day;
      let state: 'ok' | 'partial' | 'missed' | 'running' | 'upcoming';
      if (r) state = r.status === 'ok' ? 'ok' : r.status === 'running' ? 'running' : 'partial';
      else if (isToday && nowMinutes < slotMinutes + 30) state = 'upcoming';
      else state = 'missed';
      out.push({
        slot, day, hour: h, state,
        at: r ? new Date(String(r.finished_at || r.started_at)).toISOString() : '',
        detail: r ? String(r.detail || '') : '',
      });
    }
  }
  const last24 = out.filter((s) => s.state !== 'upcoming').slice(0, 3);
  const missed = out.filter((s) => s.state === 'missed');
  const alert = last24.some((s) => s.state === 'missed')
    ? `Scrape missed at ${last24.filter((s) => s.state === 'missed').map((s) => s.slot.slice(11)).join(', ')}`
    : '';
  return { slots: out, missed: missed.length, alert, perDay: SCRAPE_HOURS.length };
}
