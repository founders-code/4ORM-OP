import type { Sql } from './db';
import { fail } from './log';
import { outbound } from './outbound';

/* Production log: what got done and what was made, day by day (Vancouver days).
   Each source is read on its own so one missing table never blanks the log.
   An OpenAI-written summary of each day switches on when OPENAI_API_KEY is set. */
type Entry = { kind: string; title: string; at: string };

async function safe(name: string, job: () => Promise<Array<Record<string, unknown>>>) {
  try {
    return await job();
  } catch (err) {
    fail(`prodlog_${name}`, err);
    return [];
  }
}

function vanDay(iso: unknown) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(String(iso)));
}

export async function productionLog(sql: Sql, ownerId: string, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [tasks, steps, docs, uploads, notes, spaces, links, recs, plays, sent] = await Promise.all([
    safe('tasks', () => sql`SELECT title, updated_at AS at FROM items WHERE owner_id = ${ownerId} AND status = 'done' AND updated_at >= ${since}::timestamptz AND coalesce(source,'') <> 'gmail' ORDER BY updated_at DESC LIMIT 200` as never),
    safe('steps', () => sql`SELECT title, updated_at AS at FROM timeline_items WHERE owner_id = ${ownerId} AND status_override = 'done' AND updated_at >= ${since}::timestamptz ORDER BY updated_at DESC LIMIT 100` as never),
    safe('docs', () => sql`SELECT name AS title, created_at AS at FROM documents WHERE owner_id = ${ownerId} AND created_at >= ${since}::timestamptz ORDER BY created_at DESC LIMIT 100` as never),
    safe('uploads', () => sql`SELECT name AS title, created_at AS at FROM doc_uploads WHERE owner_id = ${ownerId} AND created_at >= ${since}::timestamptz ORDER BY created_at DESC LIMIT 100` as never),
    safe('notes', () => sql`SELECT coalesce(nullif(title,''), left(body, 60)) AS title, created_at AS at FROM notes WHERE owner_id = ${ownerId} AND created_at >= ${since}::timestamptz AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100` as never),
    safe('spaces', () => sql`SELECT name AS title, created_at AS at FROM spaces WHERE owner_id = ${ownerId} AND created_at >= ${since}::timestamptz ORDER BY created_at DESC LIMIT 100` as never),
    safe('links', () => sql`SELECT title, created_at AS at FROM links WHERE owner_id = ${ownerId} AND created_at >= ${since}::timestamptz ORDER BY created_at DESC LIMIT 100` as never),
    safe('recordings', () => sql`SELECT coalesce(nullif(title,''), 'Recording') AS title, coalesce(started_at, now()) AS at FROM recordings WHERE owner_id = ${ownerId} AND coalesce(started_at, now()) >= ${since}::timestamptz ORDER BY started_at DESC LIMIT 100` as never),
    safe('plays', () => sql`SELECT r.name AS title, l.created_at AS at FROM playbook_log l LEFT JOIN playbook_rhythms r ON r.id = l.rhythm_id WHERE l.owner_id = ${ownerId} AND l.status = 'done' AND l.created_at >= ${since}::timestamptz ORDER BY l.created_at DESC LIMIT 200` as never),
    safe('mail', () => sql`SELECT subject AS title, send_at AS at FROM scheduled_mail WHERE owner_id = ${ownerId} AND status = 'sent' AND send_at >= ${since}::timestamptz ORDER BY send_at DESC LIMIT 100` as never),
  ]);
  const all: Entry[] = [];
  const add = (kind: string, rows: Array<Record<string, unknown>>) => rows.forEach((r) => {
    if (r.at) all.push({ kind, title: String(r.title || '').slice(0, 160) || kind, at: new Date(String(r.at)).toISOString() });
  });
  add('Task done', tasks);
  add('Planner step done', steps);
  add('Document', docs);
  add('Upload', uploads);
  add('Note', notes);
  add('Space', spaces);
  add('Link saved', links);
  add('Recording', recs);
  add('Play done', plays);
  add('Email sent', sent);
  all.sort((a, b) => b.at.localeCompare(a.at));
  const byDay = new Map<string, Entry[]>();
  for (const e of all) {
    const d = vanDay(e.at);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(e);
  }
  const out = Array.from(byDay.entries()).map(([day, entries]) => {
    const counts: Record<string, number> = {};
    entries.forEach((e) => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
    return { day, counts, entries };
  });
  const summary = await aiSummary(out[0]);
  return { days: out, aiOn: !!process.env.OPENAI_API_KEY, summary };
}

/* One short paragraph about the most recent day, written by OpenAI. Off until the key is added. */
async function aiSummary(day?: { day: string; entries: Entry[] }) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key || !day || !day.entries.length) return '';
  try {
    const list = day.entries.slice(0, 60).map((e) => `${e.kind}: ${e.title}`).join('\n');
    const r = await outbound('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_LOG_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 220,
        messages: [
          { role: 'system', content: 'Write a plain, factual production log entry for a founder: 3 short sentences, what got done and what was made. No adjectives, no praise, no lists.' },
          { role: 'user', content: `Day ${day.day}:\n${list}` },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return '';
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return String(j.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    fail('prodlog_ai', err);
    return '';
  }
}
