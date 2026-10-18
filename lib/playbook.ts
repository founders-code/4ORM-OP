import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { pacificDay } from './snapshots';

type Sql = NeonQueryFunction<false, false>;

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const SEED_RHYTHMS = [
  { name: 'One move', color: '#1f5fff', route: 'war', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 1 },
  { name: '30-min video', color: '#7a5bd0', route: 'war', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 2 },
  { name: 'Post today\'s clip', color: '#c79a3a', route: 'room', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 3 },
  { name: 'Engage 10 min', color: '#3b5bdb', route: 'room', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '5', sort: 4 },
  { name: 'Reach out 5', color: '#1a9d5a', route: 'contacts', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '5', sort: 5 },
  { name: 'Raise touch', color: '#e0a81e', route: 'work', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 6 },
  { name: 'Inbox zero', color: '#1667b5', route: 'mail', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 7 },
  { name: 'Clear commitments', color: '#0f8a8a', route: 'war', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 8 },
  { name: 'Check 4ormIQ', color: '#2E6BF2', route: 'room', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 9 },
  { name: 'News sweep', color: '#17b86a', route: 'news', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 10 },
  { name: 'Shutdown + snapshot', color: '#44506a', route: 'done', schedule: ['mon', 'tue', 'wed', 'thu', 'fri'], target: '', sort: 11 },
  { name: 'Schedule clips', color: '#7a5bd0', route: 'war', schedule: ['mon'], target: '', sort: 12 },
  { name: 'Chase cold', color: '#e0483a', route: 'people', schedule: ['tue'], target: '', sort: 13 },
  { name: 'Speer sync', color: '#0f8a8a', route: 'work', schedule: ['wed'], target: '', sort: 14 },
  { name: 'Metrics snapshot', color: '#1f5fff', route: 'room', schedule: ['thu'], target: '', sort: 15 },
  { name: 'Weekly review', color: '#0b1f55', route: 'room', schedule: ['fri'], target: '', sort: 16 },
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

function shape(row: Record<string, unknown>) {
  const raw = row.schedule;
  const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
  const schedule = (Array.isArray(list) ? list : []).map((x) => String(x));
  return {
    id: String(row.id),
    name: String(row.name || ''),
    color: String(row.color || '#1f5fff'),
    route: String(row.route || 'war'),
    schedule,
    target: String(row.target || ''),
    sort: Number(row.sort) || 0,
    active: row.active !== false,
  };
}

export async function seedRhythms(sql: Sql, ownerId: string) {
  for (const row of SEED_RHYTHMS) {
    try {
      await sql`
        INSERT INTO playbook_rhythms (owner_id, name, color, route, schedule, target, sort, active)
        VALUES (${ownerId}, ${row.name}, ${row.color}, ${row.route}, ${JSON.stringify(row.schedule)}::jsonb, ${row.target}, ${row.sort}, true)
        ON CONFLICT (owner_id, name) DO NOTHING
      `;
    } catch (err) {
      fail('playbook_seed', err);
    }
  }
}

export async function listPlaybook(sql: Sql, ownerId: string, weekStart?: string) {
  await seedRhythms(sql, ownerId);
  const today = pacificDay();
  const start = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStart : mondayOf(today);
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(start, n));
  const rhythms = await sql`
    SELECT id, name, color, route, schedule, target, sort, active
    FROM playbook_rhythms
    WHERE owner_id = ${ownerId} AND active = true
    ORDER BY sort, name
  `;
  const logs = await sql`
    SELECT rhythm_id, day, status, value
    FROM playbook_log
    WHERE owner_id = ${ownerId} AND day >= ${days[0]}::date AND day <= ${days[6]}::date
  `;
  const logMap = new Map<string, { status: string; value: string }>();
  for (const row of logs as Array<{ rhythm_id?: string; day?: string; status?: string; value?: string }>) {
    logMap.set(`${row.rhythm_id}|${String(row.day).slice(0, 10)}`, { status: String(row.status || ''), value: String(row.value || '') });
  }
  const rows = (rhythms as Array<Record<string, unknown>>).map(shape).map((rhythm) => {
    const pads = days.map((day) => {
      const due = rhythm.schedule.includes(weekdayOf(day));
      const hit = logMap.get(`${rhythm.id}|${day}`);
      let state = 'empty';
      if (due && hit?.status === 'done') state = 'done';
      else if (due && hit?.status === 'snoozed') state = 'snoozed';
      else if (due && day < today) state = 'missed';
      else if (due && day === today) state = 'due';
      else if (due) state = 'scheduled';
      return { day, due, state, value: hit?.value || '' };
    });
    return { ...rhythm, pads };
  });
  let scheduled = 0;
  let done = 0;
  let todayLit = 0;
  for (const row of rows) {
    for (const pad of row.pads) {
      if (!pad.due) continue;
      scheduled += 1;
      if (pad.state === 'done') done += 1;
      if (pad.day === today && pad.state === 'due') todayLit += 1;
    }
  }
  return {
    today,
    weekStart: start,
    days,
    rows,
    score: scheduled ? Math.round((done / scheduled) * 100) : 0,
    todayLit,
    weekLabel: `Week ${isoWeek(start)} - ${labelRange(start)}`,
  };
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
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(a)}-${fmt(b)}`.toUpperCase();
}

export async function logPlay(sql: Sql, ownerId: string, rhythmId: string, day: string, status: string, value = '') {
  const next = status === 'done' || status === 'snoozed' || status === 'missed' || status === 'open' ? status : 'done';
  if (next === 'open') {
    await sql`DELETE FROM playbook_log WHERE owner_id = ${ownerId} AND rhythm_id = ${rhythmId}::uuid AND day = ${day}::date`;
    return listPlaybook(sql, ownerId);
  }
  await sql`
    INSERT INTO playbook_log (owner_id, rhythm_id, day, status, value)
    VALUES (${ownerId}, ${rhythmId}::uuid, ${day}::date, ${next}, ${value.slice(0, 80)})
    ON CONFLICT (owner_id, rhythm_id, day)
    DO UPDATE SET status = EXCLUDED.status, value = EXCLUDED.value
  `;
  return listPlaybook(sql, ownerId);
}

export async function addRhythm(sql: Sql, ownerId: string, input: { name: string; color?: string; route?: string; schedule?: string[]; target?: string }) {
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) return listPlaybook(sql, ownerId);
  const rows = await sql`SELECT coalesce(max(sort), 0)::int AS n FROM playbook_rhythms WHERE owner_id = ${ownerId}`;
  const sort = Number(rows[0]?.n || 0) + 1;
  await sql`
    INSERT INTO playbook_rhythms (owner_id, name, color, route, schedule, target, sort, active)
    VALUES (
      ${ownerId},
      ${name},
      ${String(input.color || '#1f5fff').slice(0, 20)},
      ${String(input.route || 'war').slice(0, 40)},
      ${JSON.stringify(input.schedule || ['mon', 'tue', 'wed', 'thu', 'fri'])}::jsonb,
      ${String(input.target || '').slice(0, 40)},
      ${sort},
      true
    )
    ON CONFLICT (owner_id, name) DO NOTHING
  `;
  return listPlaybook(sql, ownerId);
}
