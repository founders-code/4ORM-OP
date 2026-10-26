import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { ensureBeats, listBeats } from './playbook-beats';
import { pacificDay } from './snapshots';

type Sql = NeonQueryFunction<false, false>;

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const SEED_RHYTHMS = [
  { name: 'One move', color: '--blue', route: 'war', sub: '', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 1, nw: 0 },
  { name: '30-min video', color: '--red', route: 'studio', sub: 'Mon-Fri', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 2, nw: 0 },
  { name: 'Post today\'s clip', color: '--pink', route: 'li', sub: '', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 3, nw: 1 },
  { name: 'Engage 10 min', color: '--sky', route: 'li', sub: 'comment on 5', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '5', sort: 4, nw: 1 },
  { name: 'Reach out 5', color: '--green', route: 'pipe', sub: '', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '5', sort: 5, nw: 0 },
  { name: 'Raise touch', color: '--gold', route: 'spaces', sub: 'one cheque closer', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 6, nw: 1 },
  { name: 'Inbox zero', color: '--violet', route: 'msg', sub: '', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], target: '', sort: 7, nw: 0 },
  { name: 'Clear commitments', color: '--orange', route: 'war', sub: 'after calls', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 8, nw: 1 },
  { name: 'Check 4ormIQ', color: '--lime', route: 'iq', sub: 'launch prep → users', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 9, nw: 1 },
  { name: 'News sweep', color: '--teal', route: 'news', sub: '', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 10, nw: 0 },
  { name: 'Shutdown + snapshot', color: '--slate', route: 'done', sub: '5 min', grp: 'Daily', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '6pm', sort: 11, nw: 1 },
  { name: 'Schedule clips', color: '--pink', route: 'studio', sub: 'Mon', grp: 'Weekly', schedule: ['mon'], target: '', sort: 12, nw: 0 },
  { name: 'Chase cold', color: '--amber', route: 'contacts', sub: 'Tue', grp: 'Weekly', schedule: ['tue'], target: '', sort: 13, nw: 0 },
  { name: 'Speer sync', color: '--teal', route: 'team', sub: 'Wed', grp: 'Weekly', schedule: ['wed'], target: '', sort: 14, nw: 1 },
  { name: 'Metrics snapshot', color: '--sky', route: 'dash', sub: 'Thu', grp: 'Weekly', schedule: ['thu'], target: '', sort: 15, nw: 1 },
  { name: 'Weekly review', color: '--white', route: 'dash', sub: 'Fri', grp: 'Weekly', schedule: ['fri'], target: '', sort: 16, nw: 0 },
];

function weekdayOf(day: string) {
  const [y, m, d] = String(day).split('-').map(Number);
  const utc = Date.UTC(y, (m || 1) - 1, d || 1);
  return DOW[new Date(utc).getUTCDay()];
}

function mondayOf(day: string) {
  const [y, m, d] = String(day).split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dow = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - (dow - 1));
  return utc.toISOString().slice(0, 10);
}

function addDays(day: string, n: number) {
  const [y, m, d] = String(day).split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n));
  return utc.toISOString().slice(0, 10);
}

function firstOfMonth(day: string, offset = 0) {
  const [y, m] = String(day).split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1 + offset, 1));
  return utc.toISOString().slice(0, 10);
}

function lastOfMonth(day: string, offset = 0) {
  const [y, m] = String(day).split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) + offset, 0));
  return utc.toISOString().slice(0, 10);
}

function shape(row: Record<string, unknown>) {
  const raw = row.schedule;
  const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
  const schedule = (Array.isArray(list) ? list : []).map((x) => String(x));
  const created = String(row.created_at || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1]
    || (row.created_at instanceof Date && Number.isFinite(row.created_at.getTime())
      ? row.created_at.toISOString().slice(0, 10)
      : '');
  return {
    id: String(row.id),
    name: String(row.name || ''),
    color: String(row.color || '--blue'),
    route: String(row.route || 'war'),
    sub: String(row.sub || ''),
    grp: String(row.grp || 'Daily'),
    schedule,
    target: String(row.target || ''),
    sort: Number(row.sort) || 0,
    active: row.active !== false,
    nw: Number(row.nw) || 0,
    created_at: created,
  };
}

function padState(opts: {
  due: boolean;
  day: string;
  today: string;
  created: string;
  hit?: { status: string; value: string };
  laterToday: boolean;
}) {
  const { due, day, today, created, hit, laterToday } = opts;
  if (!due) return 'off';
  if (created && day < created) return 'before';
  if (hit?.status === 'done') return 'done';
  if (hit?.status === 'snoozed') return 'next';
  if (day < today) return 'miss';
  if (day === today) return laterToday ? 'next' : 'due';
  return 'next';
}

export async function seedRhythms(sql: Sql, ownerId: string) {
  for (const row of SEED_RHYTHMS) {
    try {
      await sql`
        INSERT INTO playbook_rhythms (owner_id, name, color, route, schedule, target, sort, active, sub, grp)
        VALUES (${ownerId}, ${row.name}, ${row.color}, ${row.route}, ${JSON.stringify(row.schedule)}::jsonb, ${row.target}, ${row.sort}, true, ${row.sub}, ${row.grp})
        ON CONFLICT (owner_id, name) DO NOTHING
      `;
      await sql`
        UPDATE playbook_rhythms
        SET color = ${row.color}, route = ${row.route}, schedule = ${JSON.stringify(row.schedule)}::jsonb,
            target = ${row.target}, sort = ${row.sort}, sub = ${row.sub}, grp = ${row.grp}
        WHERE owner_id = ${ownerId} AND name = ${row.name}
          AND (color LIKE '#%' OR color = '' OR route IN ('room','contacts','work','mail','people'))
      `;
      await sql`
        UPDATE playbook_rhythms
        SET schedule = ${JSON.stringify(row.schedule)}::jsonb, sub = ${row.sub}, grp = ${row.grp}
        WHERE owner_id = ${ownerId} AND name = ${row.name}
          AND (schedule IS NULL OR jsonb_typeof(schedule) <> 'array' OR jsonb_array_length(schedule) = 0)
      `;
    } catch (err) {
      fail('playbook_seed', err);
    }
  }
}

export async function listPlaybook(sql: Sql, ownerId: string, weekStart?: string) {
  await seedRhythms(sql, ownerId);
  // P13: rhythms with a cadence are longer beats; they leave the daily grid and come back as `beats`.
  await ensureBeats(sql);
  const today = pacificDay();
  const start = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStart : mondayOf(today);
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(start, n));
  // Month view (P11) shows last month, this month and next month, so history reaches back one month.
  const monthFrom = firstOfMonth(today, -1);
  const monthTo = lastOfMonth(today, 2);
  const rhythms = await sql`
    SELECT id, name, color, route, schedule, target, sort, active, created_at::text AS created_at, sub, grp
    FROM playbook_rhythms
    WHERE owner_id = ${ownerId} AND active = true AND cadence IS NULL
    ORDER BY sort, name
  `;
  const logs = await sql`
    SELECT rhythm_id, day::text AS day, status, value
    FROM playbook_log
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND day >= ${monthFrom}::date AND day <= ${monthTo}::date
  `;
  const logMap = new Map<string, { status: string; value: string }>();
  for (const row of logs as Array<{ rhythm_id?: string; day?: string; status?: string; value?: string }>) {
    const day = String(row.day || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] || String(row.day || '').slice(0, 10);
    logMap.set(`${row.rhythm_id}|${day}`, { status: String(row.status || ''), value: String(row.value || '') });
  }
  const seedNw = new Map(SEED_RHYTHMS.map((row) => [row.name, row.nw]));
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const rows = (rhythms as Array<Record<string, unknown>>).map((raw) => {
    const rhythm = { ...shape(raw), nw: seedNw.get(String(raw.name || '')) || 0 };
    const laterToday = /shutdown/i.test(rhythm.name) && hour < 18;
    const pads = days.map((day) => {
      const due = rhythm.schedule.includes(weekdayOf(day));
      const hit = logMap.get(`${rhythm.id}|${day}`);
      const state = padState({ due, day, today, created: rhythm.created_at, hit, laterToday });
      return { day, due, state, value: hit?.value || '' };
    });
    return { ...rhythm, pads };
  });
  let scheduled = 0;
  let done = 0;
  let todayLit = 0;
  for (const row of rows) {
    for (const pad of row.pads) {
      if (!pad.due || pad.state === 'before' || pad.state === 'off') continue;
      scheduled += 1;
      if (pad.state === 'done') done += 1;
      if (pad.day === today && (pad.state === 'due' || pad.state === 'next')) todayLit += 1;
    }
  }
  const streaks = await rhythmStreaks(sql, ownerId, today, rows);
  for (const row of rows as Array<Record<string, unknown>>) {
    const hit = streaks.byId.get(String(row.id));
    row.streak = hit?.current || 0;
    row.bestStreak = hit?.best || 0;
  }
  const monthLogs = (logs as Array<{ rhythm_id?: string; day?: string; status?: string; value?: string }>).map((row) => ({
    rhythmId: String(row.rhythm_id || ''),
    day: String(row.day || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] || String(row.day || '').slice(0, 10),
    status: String(row.status || ''),
    value: String(row.value || ''),
  }));
  return {
    today,
    weekStart: start,
    days,
    rows,
    score: scheduled ? Math.round((done / scheduled) * 100) : 0,
    todayLit,
    weekLabel: `WEEK ${isoWeek(start)} · ${labelRange(start)}`,
    monthFrom,
    monthTo,
    monthLogs,
    bestStreak: streaks.best,
    beats: await listBeats(sql, ownerId).catch((err) => {
      fail('playbook_beats', err);
      return [];
    }),
  };
}

/**
 * P14: streaks from playbook_log. A streak counts consecutive scheduled days a rhythm was done (days it is not
 * scheduled are skipped, today counts only once it is done). Looks back 180 days.
 */
async function rhythmStreaks(sql: Sql, ownerId: string, today: string, rows: Array<{ id: string; name: string; schedule: string[]; created_at: string }>) {
  const byId = new Map<string, { current: number; best: number }>();
  let best = { days: 0, name: '' };
  let done: Array<{ rhythm_id?: string; day?: string }> = [];
  try {
    done = await sql`
      SELECT rhythm_id::text AS rhythm_id, day::text AS day
      FROM playbook_log
      WHERE owner_id = ${ownerId} AND status = 'done' AND deleted_at IS NULL AND day >= (${today}::date - 180) AND day <= ${today}::date
    ` as Array<{ rhythm_id?: string; day?: string }>;
  } catch (err) {
    fail('playbook_streaks', err);
    return { byId, best };
  }
  const hits = new Set(done.map((row) => `${row.rhythm_id}|${String(row.day || '').slice(0, 10)}`));
  const from = addDays(today, -180);
  for (const row of rows) {
    if (!row.schedule.length) continue;
    let run = 0;
    let top = 0;
    let current = 0;
    for (let day = from; day <= today; day = addDays(day, 1)) {
      if (row.created_at && day < row.created_at) continue;
      if (!row.schedule.includes(weekdayOf(day))) continue;
      const ok = hits.has(`${row.id}|${day}`);
      if (ok) run += 1;
      else if (day !== today) run = 0;
      if (run > top) top = run;
    }
    current = run;
    byId.set(row.id, { current, best: top });
    if (top > best.days) best = { days: top, name: row.name };
  }
  return { byId, best };
}

function isoWeek(day: string) {
  const [y, m, d] = String(day).split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function labelRange(start: string) {
  const end = addDays(start, 6);
  const a = new Date(`${start}T12:00:00Z`);
  const b = new Date(`${end}T12:00:00Z`);
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
  return `${fmt(a)} - ${fmt(b)}`;
}

export async function logPlay(sql: Sql, ownerId: string, rhythmId: string, day: string, status: string, value = '') {
  const next = status === 'done' || status === 'snoozed' || status === 'missed' || status === 'open' ? status : 'done';
  if (next === 'open') {
    // Un-tick keeps the row and marks it undone (soft delete); ticking again clears the mark.
    await sql`UPDATE playbook_log SET deleted_at = now() WHERE owner_id = ${ownerId} AND rhythm_id = ${rhythmId}::uuid AND day = ${day}::date AND deleted_at IS NULL`;
    return listPlaybook(sql, ownerId);
  }
  await sql`
    INSERT INTO playbook_log (owner_id, rhythm_id, day, status, value)
    VALUES (${ownerId}, ${rhythmId}::uuid, ${day}::date, ${next}, ${value.slice(0, 80)})
    ON CONFLICT (owner_id, rhythm_id, day)
    DO UPDATE SET status = EXCLUDED.status, value = EXCLUDED.value, deleted_at = NULL
  `;
  return listPlaybook(sql, ownerId);
}

export async function addRhythm(sql: Sql, ownerId: string, input: { name: string; color?: string; route?: string; schedule?: string[]; target?: string; sub?: string; grp?: string }) {
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) return listPlaybook(sql, ownerId);
  const rows = await sql`SELECT coalesce(max(sort), 0)::int AS n FROM playbook_rhythms WHERE owner_id = ${ownerId}`;
  const sort = Number(rows[0]?.n || 0) + 1;
  await sql`
    INSERT INTO playbook_rhythms (owner_id, name, color, route, schedule, target, sort, active, sub, grp)
    VALUES (
      ${ownerId},
      ${name},
      ${String(input.color || '--blue').slice(0, 20)},
      ${String(input.route || 'war').slice(0, 40)},
      ${JSON.stringify(input.schedule || ['mon', 'tue', 'wed', 'thu', 'fri'])}::jsonb,
      ${String(input.target || '').slice(0, 40)},
      ${sort},
      true,
      ${String(input.sub || '').slice(0, 80)},
      ${String(input.grp || 'Daily').slice(0, 20)}
    )
    ON CONFLICT (owner_id, name) DO NOTHING
  `;
  return listPlaybook(sql, ownerId);
}
