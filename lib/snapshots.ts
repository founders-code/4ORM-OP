import type { NeonQueryFunction } from '@neondatabase/serverless';
import { withCreds } from './creds';
import { fail } from './log';
import { snapshotMail } from './google';
import { claimBudget } from './db';
import { listMeetingActions } from './meeting-actions';
import { calendarPayload } from './sync';
import { listNews } from './war';
import { loadCeoFiles } from './ceo';
import { readProfileFacts, SEED_FACTS } from './ceo-score.mjs';
import { loadCredsFor } from './vault';

type Sql = NeonQueryFunction<false, false>;

type Line = { title: string; extra?: string };
type StageCount = { name: string; count: number };

export function pacificDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function pacificMidnight(year: number, month: number, day: number) {
  const probe = Date.UTC(year, month - 1, day, 18, 0, 0);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(probe))) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  const shown = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour),
    Number(bag.minute),
    Number(bag.second),
  );
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (shown - probe));
}

export function pacificRange(dateStr: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const start = pacificMidnight(y, mo, d);
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const end = pacificMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return { start: start.toISOString(), end: end.toISOString() };
}

async function soft<T>(code: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    fail(code, err);
    return fallback;
  }
}

function oneLine(parts: string[]) {
  const clean = parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return clean.join(' · ').slice(0, 220) || 'Quiet day - nothing captured.';
}

export async function buildSnapshot(sql: Sql, ownerId: string, day = pacificDay()) {
  const range = pacificRange(day);
  if (!range) {
    return { date: day, summary: 'Quiet day - nothing captured.', payload: { headline: 'Quiet day - nothing captured.' } };
  }
  const { start, end } = range;

  const tasks = await soft('snap_tasks', async () => {
    const rows = await sql`
      SELECT title, area
      FROM items
      WHERE owner_id = ${ownerId}
        AND status = 'done'
        AND updated_at >= ${start}::timestamptz
        AND updated_at < ${end}::timestamptz
      ORDER BY updated_at DESC
      LIMIT 40
    `;
    return (rows as Array<{ title?: string; area?: string }>).map((row) => ({
      title: String(row.title || '').slice(0, 180),
      extra: String(row.area || ''),
    })).filter((row) => row.title);
  }, [] as Line[]);

  const moves = await soft('snap_moves', async () => {
    const rows = await sql`
      SELECT text, principle
      FROM ceo_moves
      WHERE owner_id = ${ownerId}
        AND status = 'done'
        AND COALESCE(updated_at, created_at) >= ${start}::timestamptz
        AND COALESCE(updated_at, created_at) < ${end}::timestamptz
      ORDER BY COALESCE(updated_at, created_at) DESC
      LIMIT 12
    `;
    return (rows as Array<{ text?: string; principle?: string }>).map((row) => ({
      title: String(row.text || '').slice(0, 180),
      extra: String(row.principle || ''),
    })).filter((row) => row.title);
  }, [] as Line[]);

  const meetings = await soft('snap_meetings', async () => {
    const events = (await calendarPayload(sql, ownerId)) as Array<{ start?: number; title?: string }>;
    return events
      .filter((ev) => {
        const at = Number(ev.start) || 0;
        return at >= Date.parse(start) && at < Date.parse(end);
      })
      .slice(0, 20)
      .map((ev) => ({ title: String(ev.title || 'Meeting').slice(0, 180) }));
  }, [] as Line[]);

  const commitments = await soft('snap_commit', async () => {
    const rows = await listMeetingActions(sql, ownerId);
    return rows
      .filter((row) => String(row.meetingDate || '').slice(0, 10) === day)
      .slice(0, 20)
      .map((row) => ({
        title: String(row.text || '').slice(0, 180),
        extra: String(row.meetingTitle || ''),
      }))
      .filter((row) => row.title);
  }, [] as Line[]);

  let mail = { sent: [] as Array<{ title: string; to: string }>, replies: [] as Array<{ title: string; from: string }> };
  try {
    const ok = await claimBudget(sql, ownerId, 'gmail', 6);
    if (ok) {
      const creds = await loadCredsFor(ownerId);
      mail = await withCreds(creds, () => snapshotMail(day));
    }
  } catch (err) {
    fail('snap_mail', err);
  }

  const pipeline = await soft('snap_pipe', async () => {
    const rows = await sql`
      SELECT stage, count(*)::int AS n
      FROM contacts
      WHERE owner_id = ${ownerId}
      GROUP BY stage
    `;
    return (rows as Array<{ stage?: string; n?: number }>).map((row) => ({
      name: String(row.stage || 'new'),
      count: Number(row.n) || 0,
    }));
  }, [] as StageCount[]);

  const prior = await soft('snap_prior', async () => {
    const rows = await sql`
      SELECT payload
      FROM daily_snapshots
      WHERE owner_id = ${ownerId} AND snap_date < ${day}::date
      ORDER BY snap_date DESC
      LIMIT 1
    `;
    const payload = rows[0]?.payload as { pipeline?: StageCount[] } | undefined;
    return Array.isArray(payload?.pipeline) ? payload.pipeline : [];
  }, [] as StageCount[]);

  const pipelineChanges = pipeline.flatMap((row) => {
    const before = prior.find((p) => p.name === row.name)?.count || 0;
    if (before === row.count) return [];
    const delta = row.count - before;
    return [{ title: `${row.name}: ${delta > 0 ? '+' : ''}${delta}`, extra: `${before} → ${row.count}` }];
  });

  const facts = (() => {
    try {
      const files = loadCeoFiles();
      return files.profile ? readProfileFacts(files.profile) : { ...SEED_FACTS };
    } catch {
      return { ...SEED_FACTS };
    }
  })();
  const raise = {
    in: 80000,
    pending: 0,
    open: 170000,
    target: 250000,
    pace: 'behind',
    cash: Number(facts.cash) || 100,
  };

  const news = await soft('snap_news', async () => {
    const items = await listNews(sql, ownerId, day, 1);
    return (items as Array<{ title?: string; source?: string; isTop?: boolean; publishedAt?: number | null; sweptOn?: string }>)
      .filter((row) => {
        const published = row.publishedAt ? pacificDay(new Date(row.publishedAt)) : '';
        return row.isTop || row.sweptOn === day || published === day;
      })
      .slice(0, 8)
      .map((row) => ({
        title: String(row.title || '').slice(0, 180),
        extra: String(row.source || ''),
      }))
      .filter((row) => row.title);
  }, [] as Line[]);

  const bits: string[] = [];
  if (tasks.length) bits.push(`${tasks.length} task${tasks.length === 1 ? '' : 's'} done`);
  if (moves.length) bits.push(`${moves.length} CEO move${moves.length === 1 ? '' : 's'} done`);
  if (meetings.length) bits.push(`${meetings.length} meeting${meetings.length === 1 ? '' : 's'}`);
  if (commitments.length) bits.push(`${commitments.length} commitment${commitments.length === 1 ? '' : 's'}`);
  if (mail.sent.length) bits.push(`${mail.sent.length} email${mail.sent.length === 1 ? '' : 's'} sent`);
  if (mail.replies.length) bits.push(`${mail.replies.length} ${mail.replies.length === 1 ? 'reply' : 'replies'}`);
  if (pipelineChanges.length) bits.push(`${pipelineChanges.length} pipeline shift${pipelineChanges.length === 1 ? '' : 's'}`);
  if (news.length) bits.push(`${news.length} news highlight${news.length === 1 ? '' : 's'}`);
  const summary = oneLine(bits);
  const headline = bits.length
    ? `What moved today: ${summary}.`
    : 'What moved today: a quiet desk - nothing captured.';

  const counts = {
    tasks: tasks.length,
    moves: moves.length,
    meetings: meetings.length,
    commitments: commitments.length,
    sent: mail.sent.length,
    replies: mail.replies.length,
    pipeline: pipelineChanges.length,
    news: news.length,
  };

  const payload = {
    headline,
    tasks,
    moves,
    meetings,
    commitments,
    sent: mail.sent,
    replies: mail.replies,
    pipeline,
    pipelineChanges,
    raise,
    news,
    counts,
  };

  return { date: day, summary, payload };
}

export async function saveSnapshot(sql: Sql, ownerId: string, day = pacificDay()) {
  const built = await buildSnapshot(sql, ownerId, day);
  await sql`
    INSERT INTO daily_snapshots (owner_id, snap_date, summary, payload, created_at)
    VALUES (${ownerId}, ${built.date}::date, ${built.summary}, ${JSON.stringify(built.payload)}::jsonb, now())
    ON CONFLICT (owner_id, snap_date)
    DO UPDATE SET summary = EXCLUDED.summary, payload = EXCLUDED.payload, created_at = now()
  `;
  return built;
}

export async function listSnapshots(sql: Sql, ownerId: string) {
  const rows = await sql`
    SELECT snap_date, summary, payload, created_at
    FROM daily_snapshots
    WHERE owner_id = ${ownerId}
    ORDER BY snap_date DESC
    LIMIT 120
  `;
  return (rows as Array<{ snap_date?: string; summary?: string; payload?: { counts?: Record<string, number> }; created_at?: string }>).map((row) => ({
    date: String(row.snap_date || '').slice(0, 10),
    summary: String(row.summary || ''),
    counts: row.payload?.counts || {},
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : '',
  }));
}

export async function getSnapshot(sql: Sql, ownerId: string, day: string) {
  const rows = await sql`
    SELECT snap_date, summary, payload, created_at
    FROM daily_snapshots
    WHERE owner_id = ${ownerId} AND snap_date = ${day}::date
    LIMIT 1
  `;
  const row = rows[0] as { snap_date?: string; summary?: string; payload?: unknown; created_at?: string } | undefined;
  if (!row) return null;
  return {
    date: String(row.snap_date || '').slice(0, 10),
    summary: String(row.summary || ''),
    payload: row.payload || {},
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : '',
  };
}
