import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { allowArea, allowPriority, allowStatus, parseDue } from './guard.mjs';
import { env } from './env.mjs';
import { outbound } from './outbound';
import { fail } from './log';
import { listPipelines } from './ghl';
import { listMeetingActions } from './meeting-actions';
import { calendarPayload } from './sync';
import { listNews } from './war';
import {
  PRINCIPLES,
  SEED_FACTS,
  computeLamps,
  dayDiff,
  pickMoves,
  readProfileFacts,
  wordFor,
} from './ceo-score.mjs';

type Sql = NeonQueryFunction<false, false>;

type MoveRow = {
  id: string;
  rank: number;
  text: string;
  principle: string;
  why_now: string;
  area: string;
  suggested_due: string | null;
  status: string;
  source_key: string | null;
  source_line?: string | null;
  how?: unknown;
};

const ROOT = () => join(process.cwd(), 'ceo');

function readRel(rel: string) {
  const path = join(ROOT(), rel);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

function firstRel(paths: string[]) {
  for (const rel of paths) {
    const text = readRel(rel);
    if (text) return text;
  }
  return '';
}

function principlesText() {
  const dir = ROOT();
  const folder = ['shared/principles', 'principles'].map((rel) => join(dir, rel)).find((path) => existsSync(path));
  if (!folder) return '';
  return readdirSync(folder)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => readFileSync(join(folder, name), 'utf8'))
    .join('\n\n');
}

export function loadCeoFiles() {
  return {
    persona: firstRel(['CLAUDE.md', 'persona.md']),
    principles: principlesText(),
    profile: firstRel(['shared/company-profile.md', 'company-profile.md']),
    guardrails: firstRel(['_config/guardrails.md', 'config/guardrails.md']),
    voice: firstRel(['_config/voice.md', 'config/voice.md']),
    weights: firstRel(['_config/weights.md', 'config/weights.md']),
    lamps: firstRel(['_config/lamps.md', 'config/lamps.md']),
  };
}

function playbookFor(message: string) {
  const text = message.toLowerCase();
  const name = /raise|investor|close/.test(text)
    ? 'close-the-raise.md'
    : /customer|broker|buyer/.test(text)
      ? 'first-ten-customers.md'
      : /regulator|fcac|licen/.test(text)
        ? 'regulator-first.md'
        : /cash|spend|burn|runway/.test(text)
          ? 'cash-crunch.md'
          : '';
  if (!name) return '';
  return firstRel([`skills/${name}`, `playbooks/${name}`]);
}

function stepsOf(value: unknown) {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((step) => String(step || '').trim()).filter(Boolean).slice(0, 4);
}

function asDate(value: unknown) {
  if (!value) return null;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function zoneLabel(row: { principle?: string; area?: string; text?: string; why_now?: string }) {
  const blob = `${row.principle || ''} ${row.area || ''} ${row.text || ''} ${row.why_now || ''}`.toLowerCase();
  if (/regulat|fcac|licen/.test(blob) || row.area === 'legal') return 'Regulator';
  if (/partner|broker|outreach/.test(blob) || row.area === 'outreach') return 'Partners';
  if (/cash|runway|spend|burn/.test(blob)) return 'Cash';
  if (/product|build|ship/.test(blob) || row.area === 'dev') return 'Product';
  return 'Raise';
}

function shapeMove(row: MoveRow) {
  const principle = String(row.principle || '');
  const rank = Number(row.rank) || 0;
  return {
    id: String(row.id),
    rank,
    text: String(row.text || ''),
    principle,
    principleLabel: PRINCIPLES[principle as keyof typeof PRINCIPLES] || principle,
    whyNow: String(row.why_now || ''),
    how: stepsOf(row.how),
    area: String(row.area || 'other'),
    zone: zoneLabel(row),
    severity: rank === 1 ? 'high' : rank === 2 ? 'medium' : 'low',
    suggestedDue: asDate(row.suggested_due),
    status: String(row.status || 'open'),
    source: String(row.source_line || '').trim(),
  };
}

function shapeLamp(row: Record<string, unknown>) {
  const state = String(row.state || 'unknown');
  return {
    key: String(row.key || ''),
    state,
    word: wordFor(state),
    label: String(row.label || ''),
    detail: String(row.detail || ''),
  };
}

function shapeDecision(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    moveId: row.move_id ? String(row.move_id) : null,
    context: String(row.context || ''),
    options: String(row.options || ''),
    evidence: String(row.evidence || ''),
    caseAgainst: String(row.case_against || ''),
    decision: String(row.decision || ''),
    owner: String(row.owner || ''),
    reviewDate: asDate(row.review_date),
    createdAt: asDate(row.created_at),
  };
}

export async function readCeo(sql: Sql, ownerId: string) {
  const lamps = await sql`
    SELECT key, state, label, detail, computed_at
    FROM ceo_lamps
    WHERE owner_id = ${ownerId}
    ORDER BY key
  `;
  let moves: MoveRow[] = [];
  try {
    moves = await sql`
      SELECT id, rank, text, principle, why_now, how, area, suggested_due, status, source_key, source_line
      FROM ceo_moves
      WHERE owner_id = ${ownerId} AND status = 'open'
      ORDER BY rank
    ` as MoveRow[];
  } catch (err) {
    fail('ceo_moves_source', err);
    moves = await sql`
      SELECT id, rank, text, principle, why_now, how, area, suggested_due, status, source_key
      FROM ceo_moves
      WHERE owner_id = ${ownerId} AND status = 'open'
      ORDER BY rank
    ` as MoveRow[];
  }
  const decisions = await sql`
    SELECT id, move_id, context, options, evidence, case_against, decision, owner, review_date, created_at
    FROM ceo_decisions
    WHERE owner_id = ${ownerId}
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return {
    lamps: (lamps as Record<string, unknown>[]).map(shapeLamp),
    moves: (moves as MoveRow[]).map(shapeMove),
    decisions: (decisions as Record<string, unknown>[]).map(shapeDecision),
  };
}

async function loadWeights(sql: Sql, ownerId: string) {
  const rows = await sql`SELECT key, boost FROM ceo_weights WHERE owner_id = ${ownerId}`;
  const weights: Record<string, number> = {};
  for (const row of rows as Array<{ key: string; boost: number }>) weights[String(row.key)] = Number(row.boost);
  return weights;
}

function weekBounds(now: Date) {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Edmonton', weekday: 'short' }).format(now);
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const start = Date.parse(`${ymd}T00:00:00Z`) - (idx < 0 ? 0 : idx) * 86400000;
  return { start, end: start + 7 * 86400000 };
}

export async function refreshCeo(sql: Sql, ownerId: string, now = new Date()) {
  const files = loadCeoFiles();
  const parsed = readProfileFacts(files.profile);
  const facts = files.profile ? parsed : { ...SEED_FACTS };
  const items = await sql`
    SELECT id, title, area, status, priority, due, owner, category
    FROM items
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  const contacts = await sql`
    SELECT id, name, type, stage, next_date, last_touch
    FROM contacts
    WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    ORDER BY name
    LIMIT 200
  `;
  const calendar = await sql`SELECT events FROM calendar_cache WHERE owner_id = ${ownerId}`;
  const sync = await sql`
    SELECT source, status FROM sync_state
    WHERE owner_id = ${ownerId} AND source IN ('calendar', 'ghl')
  `;
  const quiet = await sql`
    SELECT text, source_key
    FROM ceo_moves
    WHERE owner_id = ${ownerId}
      AND status IN ('done', 'snoozed')
      AND snooze_until > now()
  `;
  const weights = await loadWeights(sql, ownerId);
  const open = (items as Array<Record<string, unknown>>)
    .filter((row) => row.status !== 'done' && row.status !== 'dropped')
    .map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      area: String(row.area || 'other'),
      status: String(row.status || 'open'),
      priority: String(row.priority || 'normal'),
      owner: String(row.owner || ''),
      category: String(row.category || ''),
      due: asDate(row.due),
    }));
  const overdueRows = open.filter((item) => ['investors', 'outreach', 'follow_up', 'send'].includes(item.area) && item.due != null && dayDiff(item.due, now) < 0);
  const oldest = overdueRows.reduce((max, item) => Math.max(max, item.due == null ? 0 : -dayDiff(item.due, now)), 0);
  const regulator = open
    .filter((item) => item.category === 'Regulatory' || /regulator|fcac|partner/i.test(item.title))
    .map((item) => ({ due: item.due, owner: item.owner }));
  const eventsRaw = (calendar[0] as { events?: unknown } | undefined)?.events;
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];
  const syncRows = sync as Array<{ source: string; status: string }>;
  const calendarKnown = events.length > 0 || syncRows.some((row) => row.source === 'calendar' && row.status === 'connected');
  const ghlKnown = syncRows.some((row) => row.source === 'ghl' && row.status === 'connected') || (contacts as unknown[]).length > 0;
  const bounds = weekBounds(now);
  let conversations: number | null = null;
  if (calendarKnown || ghlKnown) {
    let count = 0;
    for (const event of events as Array<{ start?: number; title?: string }>) {
      const start = Number(event.start) || 0;
      if (start >= bounds.start && start < bounds.end) count += 1;
    }
    for (const contact of contacts as Array<{ next_date?: string; last_touch?: string; type?: string }>) {
      const next = asDate(contact.next_date);
      const touch = asDate(contact.last_touch);
      const hit = (next != null && next >= bounds.start && next < bounds.end) || (touch != null && touch >= bounds.start && touch < bounds.end);
      if (hit && contact.type !== 'vc') count += 1;
    }
    conversations = count;
  }
  const lamps = computeLamps({
    now,
    cash: facts.cash,
    burnMonthly: facts.burnMonthly,
    closeOn: facts.closeOn,
    closeLabel: facts.closeLabel,
    topShare: facts.topShare,
    moneyState: facts.moneyState,
    committedSpend: facts.committedSpend,
    overdue: { count: overdueRows.length, oldest },
    conversations,
    regulator,
    exits: null,
  });
  const quietTexts: string[] = [];
  const quietKeys: string[] = [];
  for (const row of quiet as Array<{ text?: string; source_key?: string }>) {
    if (row.text) quietTexts.push(String(row.text));
    if (row.source_key) quietKeys.push(String(row.source_key));
  }
  try {
    const today = edmontonDay(now);
    const snoozed = await sql`
      SELECT move_key FROM move_snooze
      WHERE owner_id = ${ownerId} AND snoozed_on = ${today}::date
        AND (to_jsonb(move_snooze) ->> 'cleared_at') IS NULL
    `;
    for (const row of snoozed as Array<{ move_key?: string }>) {
      if (row.move_key) quietKeys.push(String(row.move_key));
    }
  } catch (err) {
    fail('ceo_snooze', err);
  }
  const moves = pickMoves({ now, items: open, lamps, weights, facts, quietTexts, quietKeys });
  await sql`DELETE FROM ceo_moves WHERE owner_id = ${ownerId} AND status = 'open'`;
  for (const row of lamps) {
    await sql`
      INSERT INTO ceo_lamps (owner_id, key, state, label, detail, computed_at)
      VALUES (${ownerId}, ${row.key}, ${row.state}, ${row.label}, ${row.detail}, now())
      ON CONFLICT (owner_id, key)
      DO UPDATE SET state = EXCLUDED.state, label = EXCLUDED.label, detail = EXCLUDED.detail, computed_at = now()
    `;
  }
  for (const move of moves) {
    const due = move.suggestedDue;
    await sql`
      INSERT INTO ceo_moves (owner_id, rank, text, principle, why_now, area, suggested_due, status, source_key, how)
      VALUES (${ownerId}, ${move.rank}, ${move.text}, ${move.principle}, ${move.whyNow}, ${move.area}, ${due}, 'open', ${move.sourceKey}, ${JSON.stringify(move.how || [])}::jsonb)
    `;
  }
  return readCeo(sql, ownerId);
}

export async function ensureCeo(sql: Sql, ownerId: string) {
  const current = await readCeo(sql, ownerId);
  if (!current.lamps.length && !current.moves.length) return refreshCeo(sql, ownerId);
  return current;
}

function pacificDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export async function ceoContext(sql: Sql, ownerId: string) {
  const files = loadCeoFiles();
  const facts = files.profile ? readProfileFacts(files.profile) : { ...SEED_FACTS };
  const cash = Number(facts.cash) || 100;
  const burn = Number(facts.burnMonthly) || 90050;
  const runwayDays = burn > 0 ? Math.max(0, Math.round((cash / burn) * 30)) : 1;
  const raise = { in: 80000, pending: 0, open: 170000, target: 250000, pace: 'behind' };
  let pipelines: Array<{ name: string; total: number; stages: Array<{ name: string; count: number }> }> = [];
  try {
    const all = await listPipelines();
    pipelines = (all.pipelines || []).map((pipe) => ({
      name: pipe.name,
      total: pipe.total,
      stages: pipe.stages.map((stage) => ({ name: stage.name, count: stage.count })),
    }));
  } catch (err) {
    fail('ceo_context_ghl', err);
  }
  let meetings: Array<{ id: string; start: number; title: string }> = [];
  try {
    const events = (await calendarPayload(sql, ownerId)) as Array<{ id: string; start: number; title: string }>;
    const start = Date.now() - 60 * 60 * 1000;
    const end = Date.now() + 18 * 60 * 60 * 1000;
    meetings = events.filter((ev) => ev.start >= start && ev.start <= end).slice(0, 12);
  } catch (err) {
    fail('ceo_context_cal', err);
  }
  let commitments: Array<{ text: string; kind: string; meetingTitle: string }> = [];
  try {
    commitments = (await listMeetingActions(sql, ownerId)).slice(0, 12).map((row) => ({
      text: row.text,
      kind: row.kind,
      meetingTitle: row.meetingTitle,
    }));
  } catch (err) {
    fail('ceo_context_actions', err);
  }
  let news: Array<{ title: string; source: string; impact: string }> = [];
  try {
    const items = await listNews(sql, ownerId);
    news = items.slice(0, 5).map((row: { title?: string; source?: string; impact?: string }) => ({
      title: String(row.title || ''),
      source: String(row.source || ''),
      impact: String(row.impact || ''),
    }));
  } catch (err) {
    fail('ceo_context_news', err);
  }
  let inbox = { vc: 0, needs: 0 };
  try {
    const rows = await sql`
      SELECT title, area, priority FROM items
      WHERE owner_id = ${ownerId} AND status IN ('new', 'open', 'doing', 'waiting')
      LIMIT 80
    `;
    inbox = {
      vc: (rows as Array<{ area?: string; title?: string }>).filter((row) => /vc|investor/i.test(`${row.area || ''} ${row.title || ''}`)).length,
      needs: (rows as Array<{ priority?: string }>).filter((row) => row.priority === 'urgent' || row.priority === 'high').length,
    };
  } catch (err) {
    fail('ceo_context_inbox', err);
  }
  return { cash, runwayDays, raise, pipelines, meetings, inbox, commitments, news };
}

function principleForZone(zone: string) {
  if (/regulat/i.test(zone)) return 'P4';
  if (/partner/i.test(zone)) return 'P2';
  return 'P1';
}

function areaForZone(zone: string) {
  if (/regulat|legal/i.test(zone)) return 'legal';
  if (/partner/i.test(zone)) return 'outreach';
  if (/product/i.test(zone)) return 'dev';
  return 'investors';
}

async function writeDailyMoves(sql: Sql, ownerId: string, rows: Array<Record<string, unknown>>) {
  const day = pacificDay();
  const cleaned = rows.slice(0, 3).map((row, i) => {
    const text = String(row.title || row.text || '').replace(/[\u2013\u2014]/g, '-').trim().slice(0, 180);
    const why = String(row.why || row.whyNow || '').replace(/[\u2013\u2014]/g, '-').trim().slice(0, 280);
    const zone = String(row.zone || 'Raise').slice(0, 24);
    const how = Array.isArray(row.how) ? row.how.map((step) => String(step || '').slice(0, 120)).filter(Boolean).slice(0, 4) : [];
    return {
      rank: i + 1,
      text,
      why,
      zone,
      how,
      principle: principleForZone(zone),
      area: areaForZone(zone),
      sourceKey: `daily:${day}:${i + 1}`,
      sourceLine: String(row.source || row.signals || '').replace(/[\u2013\u2014]/g, '-').trim().slice(0, 180),
    };
  }).filter((row) => row.text);
  if (!cleaned.length) return null;
  await sql`DELETE FROM ceo_moves WHERE owner_id = ${ownerId} AND status = 'open'`;
  for (const move of cleaned) {
    try {
      await sql`
        INSERT INTO ceo_moves (owner_id, rank, text, principle, why_now, area, suggested_due, status, source_key, how, source_line)
        VALUES (${ownerId}, ${move.rank}, ${move.text}, ${move.principle}, ${move.why}, ${move.area}, ${null}, 'open', ${move.sourceKey}, ${JSON.stringify(move.how)}::jsonb, ${move.sourceLine})
      `;
    } catch (err) {
      fail('ceo_daily_insert', err);
      await sql`
        INSERT INTO ceo_moves (owner_id, rank, text, principle, why_now, area, suggested_due, status, source_key, how)
        VALUES (${ownerId}, ${move.rank}, ${move.text}, ${move.principle}, ${move.why}, ${move.area}, ${null}, 'open', ${move.sourceKey}, ${JSON.stringify(move.how)}::jsonb)
      `;
    }
  }
  return readCeo(sql, ownerId);
}

async function dailyBrainJson(system: string, prompt: string) {
  const anthropicKey = env('ANTHROPIC_API_KEY');
  const openaiKey = env('OPENAI_API_KEY');
  const model = env('CEO_MODEL');
  if (anthropicKey) {
    const res = await outbound('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return '';
    const body = await res.json() as { content?: Array<{ type: string; text?: string }> };
    return (body.content || []).filter((block) => block.type === 'text').map((block) => block.text || '').join('\n');
  }
  if (openaiKey) {
    const res = await outbound('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        max_tokens: 1500,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return '';
    const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return body.choices?.[0]?.message?.content || '';
  }
  return '';
}

function parseDailyMoves(raw: string) {
  const text = String(raw || '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row === 'object') as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

export async function dailyCeo(sql: Sql, ownerId: string, incoming: unknown[] | null) {
  if (Array.isArray(incoming) && incoming.length) {
    const saved = await writeDailyMoves(sql, ownerId, incoming as Array<Record<string, unknown>>);
    if (saved) return saved;
  }
  try {
    const context = await ceoContext(sql, ownerId);
    const files = loadCeoFiles();
    const system = [
      files.persona || 'You are Chad Johnston\'s second CEO at 4orm Finance. You advise. Chad decides.',
      files.principles,
      files.guardrails,
      files.voice,
      files.profile,
      'Ground today in leverage, cash-first, focus, and sequencing. Regulator is the lowest priority. Hyphens only. Do not describe 4orm as an AI company. Do not invent a name, Gmail, post count, or cheque name. Use only names and numbers in the live context JSON.',
      'Each title must be one actionable move for today (a conversation to open, a send, a call, a follow-up). Never use the big goal as the title (the raise target belongs in the stakes ribbon, not the one-move). Rank 1 is today\'s one move.',
    ].filter(Boolean).join('\n\n');
    const prompt = `Live context JSON:\n${JSON.stringify(context)}\n\nReturn ONLY a JSON array of 3 objects: [{"rank":1,"title":"...","zone":"Raise|Partners|Regulator|Cash|Product","severity":"high|medium|low","why":"one line tied to a live number","source":"short signal names, e.g. Raise tracker + a meeting name","how":["step","step"]}]. Highest-leverage first. Title = the action, not the goal.`;
    const raw = await dailyBrainJson(system, prompt);
    const parsed = parseDailyMoves(raw);
    const saved = await writeDailyMoves(sql, ownerId, parsed);
    if (saved) return saved;
  } catch (err) {
    fail('ceo_daily_brain', err);
  }
  return refreshCeo(sql, ownerId);
}

async function logDecision(sql: Sql, ownerId: string, moveId: string | null, fields: {
  context: string;
  options: string;
  evidence: string;
  caseAgainst: string;
  decision: string;
  reviewDate: string | null;
}) {
  await sql`
    INSERT INTO ceo_decisions (owner_id, move_id, context, options, evidence, case_against, decision, owner, review_date)
    VALUES (${ownerId}, ${moveId}, ${fields.context.slice(0, 2000)}, ${fields.options.slice(0, 500)}, ${fields.evidence.slice(0, 2000)}, ${fields.caseAgainst.slice(0, 2000)}, ${fields.decision.slice(0, 2000)}, 'Chad', ${fields.reviewDate})
  `;
}

/* Moves are rewritten when the board refreshes, so an id on a page loaded earlier can be gone.
   The page also sends the move's text; the same move under its new id is used then. */
async function loadMove(sql: Sql, ownerId: string, id: string, text = '') {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql`
    SELECT id, rank, text, principle, why_now, how, area, suggested_due, status, source_key
    FROM ceo_moves
    WHERE id = ${id} AND owner_id = ${ownerId}
    LIMIT 1
  `;
  if (rows[0] || !text.trim()) return (rows[0] as MoveRow | undefined) || null;
  const same = await sql`
    SELECT id, rank, text, principle, why_now, how, area, suggested_due, status, source_key
    FROM ceo_moves
    WHERE owner_id = ${ownerId} AND status = 'open' AND text = ${text.trim().slice(0, 2000)}
    LIMIT 1
  `;
  return (same[0] as MoveRow | undefined) || null;
}

export async function doMove(sql: Sql, ownerId: string, id: string, text = '') {
  const move = await loadMove(sql, ownerId, id, text);
  if (!move || move.status !== 'open') return null;
  const area = allowArea(move.area) || 'other';
  const due = move.suggested_due ? new Date(move.suggested_due).toISOString() : null;
  const title = String(move.text || '').slice(0, 180);
  const source = String(move.source_key || '');
  const itemId = source.startsWith('item:') ? source.slice(5) : '';
  if (/^[0-9a-f-]{36}$/i.test(itemId)) {
    const updated = await sql`
      UPDATE items
      SET status = 'doing',
          area = ${area},
          due = COALESCE(${due}::timestamptz, due),
          updated_at = now()
      WHERE id = ${itemId} AND owner_id = ${ownerId}
      RETURNING id
    `;
    if (!updated.length) {
      await sql`
        INSERT INTO items (owner_id, title, area, status, priority, due, owner, source)
        VALUES (${ownerId}, ${title}, ${area}, 'new', 'urgent', ${due}, 'Chad', 'ceo')
      `;
    }
  } else {
    await sql`
      INSERT INTO items (owner_id, title, area, status, priority, due, owner, source)
      VALUES (${ownerId}, ${title}, ${area}, 'new', 'urgent', ${due}, 'Chad', 'ceo')
    `;
  }
  await sql`
    UPDATE ceo_moves
    SET status = 'done', snooze_until = now() + interval '3 days', updated_at = now()
    WHERE id = ${move.id} AND owner_id = ${ownerId}
  `;
  await rerankOpenMoves(sql, ownerId);
  await logDecision(sql, ownerId, move.id, {
    context: move.text,
    options: 'Do | Not now | Ask',
    evidence: move.why_now || '',
    caseAgainst: '',
    decision: 'Do',
    reviewDate: due,
  });
  return readCeo(sql, ownerId);
}

function edmontonDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export async function snoozeMove(sql: Sql, ownerId: string, id: string, reason: string, text = '') {
  const move = await loadMove(sql, ownerId, id, text);
  if (!move || move.status !== 'open') return null;
  const key = String(move.source_key || move.text || '').trim().slice(0, 180);
  if (!key) return null;
  const today = edmontonDay();
  try {
    await sql`
      INSERT INTO move_snooze (owner_id, move_key, snoozed_on)
      VALUES (${ownerId}, ${key}, ${today}::date)
      ON CONFLICT (owner_id, move_key, snoozed_on) DO NOTHING
    `;
  } catch (err) {
    fail('ceo_snooze', err);
    return null;
  }
  try {
    // A snooze undone earlier today is marked cleared; snoozing again re-arms it.
    await sql`
      UPDATE move_snooze SET cleared_at = NULL
      WHERE owner_id = ${ownerId} AND move_key = ${key} AND snoozed_on = ${today}::date
    `;
  } catch (err) {
    fail('ceo_snooze_rearm', err);
  }
  const why = reason.trim().slice(0, 500);
  await sql`
    UPDATE ceo_moves
    SET status = 'snoozed', snooze_until = (${today}::date + interval '1 day'), updated_at = now()
    WHERE id = ${move.id} AND owner_id = ${ownerId}
  `;
  await rerankOpenMoves(sql, ownerId);
  await logDecision(sql, ownerId, move.id, {
    context: move.text,
    options: 'Do | Not now | Ask',
    evidence: move.why_now || '',
    caseAgainst: why,
    decision: 'Not now',
    reviewDate: `${today}T23:59:00`,
  });
  return readCeo(sql, ownerId);
}

/** Undo a snooze: the move comes back as open and the snooze marker is kept but marked cleared (soft). */
export async function unsnoozeMove(sql: Sql, ownerId: string, id: string) {
  const move = await loadMove(sql, ownerId, id);
  if (!move) return null;
  if (move.status === 'open') return readCeo(sql, ownerId);
  if (move.status !== 'snoozed') return null;
  const key = String(move.source_key || move.text || '').trim().slice(0, 180);
  const today = edmontonDay();
  if (key) {
    try {
      await sql`
        UPDATE move_snooze SET cleared_at = now()
        WHERE owner_id = ${ownerId} AND move_key = ${key} AND snoozed_on = ${today}::date
      `;
    } catch (err) {
      fail('ceo_unsnooze', err);
      return null;
    }
  }
  await sql`
    UPDATE ceo_moves
    SET status = 'open', snooze_until = NULL, updated_at = now()
    WHERE id = ${move.id} AND owner_id = ${ownerId}
  `;
  await rerankOpenMoves(sql, ownerId);
  return readCeo(sql, ownerId);
}

async function rerankOpenMoves(sql: Sql, ownerId: string) {
  try {
    const rows = await sql`
      SELECT id FROM ceo_moves
      WHERE owner_id = ${ownerId} AND status = 'open'
      ORDER BY rank, created_at
    `;
    let rank = 1;
    for (const row of rows as Array<{ id: string }>) {
      await sql`UPDATE ceo_moves SET rank = ${rank} WHERE id = ${row.id} AND owner_id = ${ownerId}`;
      rank += 1;
      if (rank > 3) break;
    }
  } catch (err) {
    fail('ceo_rerank', err);
  }
}

export async function setWeight(sql: Sql, ownerId: string, principle: string, boost: number) {
  if (!/^P(?:1[0-2]|[1-9])$/.test(principle)) return null;
  if (!Number.isInteger(boost) || boost < -100 || boost > 200) return null;
  await sql`
    INSERT INTO ceo_weights (owner_id, key, boost)
    VALUES (${ownerId}, ${principle}, ${boost})
    ON CONFLICT (owner_id, key) DO UPDATE SET boost = EXCLUDED.boost
  `;
  return refreshCeo(sql, ownerId);
}

function boardSnapshot(items: Array<Record<string, unknown>>, contacts: Array<Record<string, unknown>>) {
  return {
    items: items.slice(0, 60).map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      area: String(row.area || ''),
      status: String(row.status || ''),
      priority: String(row.priority || ''),
      owner: String(row.owner || ''),
      due: row.due ? new Date(String(row.due)).toISOString() : null,
    })),
    contacts: contacts.slice(0, 40).map((row) => ({
      name: String(row.name || ''),
      type: String(row.type || ''),
      stage: String(row.stage || ''),
      next: String(row.next_action || ''),
    })),
  };
}

export function cleanReply(text: string) {
  return String(text || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\bKCS\b/g, 'the firm')
    .replace(/4orm is an AI company/gi, '4orm Finance')
    .trim()
    .slice(0, 4000);
}

function offlineReply(moves: Array<{ text: string; principle: string; whyNow: string }>) {
  const lines = moves.map((move) => `${move.principle}. ${move.text} ${move.whyNow}`).join('\n');
  return cleanReply(lines ? `Counsel is not connected.\n${lines}` : 'Counsel is not connected.');
}

async function applyTool(sql: Sql, ownerId: string, name: string, raw: Record<string, unknown>) {
  if (name === 'read_board') {
    const items = await sql`
      SELECT id, title, area, status, priority, due, owner
      FROM items WHERE owner_id = ${ownerId}
      ORDER BY updated_at DESC LIMIT 60
    `;
    const contacts = await sql`
      SELECT name, type, stage, next_action
      FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY name LIMIT 40
    `;
    return boardSnapshot(items as Array<Record<string, unknown>>, contacts as Array<Record<string, unknown>>);
  }
  if (name === 'add_item') {
    const title = String(raw.title || '').trim().slice(0, 180);
    const area = allowArea(String(raw.area || 'other'));
    const priority = allowPriority(String(raw.priority || 'normal'));
    const parsed = Object.prototype.hasOwnProperty.call(raw, 'due') ? parseDue(raw.due) : { ok: true, iso: null };
    if (!title || !area || !priority || !parsed.ok) return { error: 'The item needs a title and an allowed area.' };
    const rows = await sql`
      INSERT INTO items (owner_id, title, area, status, priority, due, owner, source)
      VALUES (${ownerId}, ${title}, ${area}, 'new', ${priority}, ${parsed.iso}, 'Chad', 'ceo')
      RETURNING id, title
    `;
    return { id: String((rows[0] as { id: string }).id), title };
  }
  if (name === 'update_item') {
    const id = String(raw.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'That item is not on the desk.' };
    const setStatus = allowStatus(String(raw.status || '')) || null;
    const setArea = raw.area == null ? null : allowArea(String(raw.area));
    const setPriority = raw.priority == null ? null : allowPriority(String(raw.priority));
    const title = raw.title == null ? '' : String(raw.title).trim().slice(0, 240);
    const parsed = raw.due == null ? { ok: true, iso: null } : parseDue(raw.due);
    if ((raw.title != null && !title) || (raw.area != null && !setArea) || (raw.priority != null && !setPriority) || !parsed.ok) {
      return { error: 'That update is not allowed.' };
    }
    const rows = await sql`
      UPDATE items
      SET title = CASE WHEN ${raw.title != null} THEN ${title} ELSE title END,
          area = CASE WHEN ${setArea != null} THEN ${setArea} ELSE area END,
          status = CASE WHEN ${setStatus != null} THEN ${setStatus} ELSE status END,
          priority = CASE WHEN ${setPriority != null} THEN ${setPriority} ELSE priority END,
          due = CASE WHEN ${raw.due != null} THEN ${parsed.iso}::timestamptz ELSE due END,
          updated_at = now()
      WHERE id = ${id} AND owner_id = ${ownerId}
      RETURNING id, title, status
    `;
    if (!rows.length) return { error: 'That item is not on the desk.' };
    return rows[0];
  }
  if (name === 'log_decision') {
    const decision = String(raw.decision || '').trim().slice(0, 2000);
    if (!decision) return { error: 'A decision needs a line.' };
    await logDecision(sql, ownerId, null, {
      context: String(raw.context || '').slice(0, 2000),
      options: String(raw.options || '').slice(0, 500),
      evidence: String(raw.evidence || '').slice(0, 2000),
      caseAgainst: String(raw.caseAgainst || raw.case_against || '').slice(0, 2000),
      decision,
      reviewDate: null,
    });
    return { logged: true };
  }
  return { error: 'Unknown tool.' };
}

const TOOLS = [
  {
    name: 'read_board',
    description: 'Read the live board: open items and contacts for this signed-in owner.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_item',
    description: 'Add one loose end to the board. Never send, sign, pay, or promise.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        area: { type: 'string' },
        priority: { type: 'string' },
        due: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_item',
    description: 'Update one board item that already belongs to this owner.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        area: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        due: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'log_decision',
    description: 'Log a decision Chad made. You advise. He decides.',
    input_schema: {
      type: 'object',
      properties: {
        context: { type: 'string' },
        options: { type: 'string' },
        evidence: { type: 'string' },
        caseAgainst: { type: 'string' },
        decision: { type: 'string' },
      },
      required: ['decision'],
    },
  },
];

async function anthropicTurn(key: string, model: string, system: string, messages: unknown[]) {
  const res = await outbound('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 900, system, messages, tools: TOOLS }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason?: string };
}

async function openaiTurn(key: string, model: string, system: string, messages: unknown[]) {
  const tools = TOOLS.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
  }));
  const res = await outbound('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: system }, ...messages], tools }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
  };
}

export function standingReply(message: string) {
  const text = message.toLowerCase();
  if (/how/.test(text) && /friends-and-family|250,000|close the round|private network/.test(text)) {
    return [
      'Close the friends-and-family round to $250,000. $80,000 is in. $170,000 to go.',
      '1. Open the next conversation with Kevin, then Zahar, BJ, and Daryl.',
      '2. Assign each one a $25,000 chunk. That is about seven cheques.',
      '3. For each name write the chunk, the step, the next action, and the next date.',
      '4. Log the reply the same day and move to the next name.',
    ].join('\n');
  }
  if (/how/.test(text) && /spend|cash cannot|cannot cover/.test(text)) {
    return [
      'Cash cannot cover the monthly burn.',
      '1. List every bill the cash in the bank cannot cover this month.',
      '2. Protect the product build. Defer every other line.',
      '3. Pay the deferred lines only as cash from the round lands.',
    ].join('\n');
  }
  if (/how/.test(text) && /subscription|corporate-docs|corp doc/.test(text)) {
    return [
      'The subscription agreement goes to counsel. Leave the signature with counsel.',
      '1. Pull the current corporate-docs subscription draft.',
      '2. Send it to counsel with the open questions.',
      '3. Take their edits. Leave the signature with counsel.',
      '4. Paper each payment only as counsel directs.',
    ].join('\n');
  }
  return '';
}

export async function chatCeo(sql: Sql, ownerId: string, message: string) {
  const text = message.trim().slice(0, 2000);
  if (!text) return { reply: '', wrote: false };
  const standing = standingReply(text);
  if (standing) return { reply: cleanReply(standing), wrote: false };
  const current = await ensureCeo(sql, ownerId);
  const files = loadCeoFiles();
  const items = await sql`
    SELECT id, title, area, status, priority, due, owner
    FROM items WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC LIMIT 60
  `;
  const contacts = await sql`
    SELECT name, type, stage, next_action
    FROM contacts WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    ORDER BY name LIMIT 40
  `;
  const snapshot = boardSnapshot(items as Array<Record<string, unknown>>, contacts as Array<Record<string, unknown>>);
  const persona = files.persona || 'You are Chad Johnston\'s second CEO at 4orm Finance. You advise. Chad decides. You never send, sign, pay, promise, or commit on his behalf.';
  const system = [
    persona,
    files.principles,
    files.guardrails,
    files.voice,
    files.profile ? `Company profile:\n${files.profile}` : `Company facts: cash $100 as of 12 Oct 2026. Burn about $90,050 a month. Raise $80,000 in of a $2,050,000 pre-seed, close about 30 Oct 2026.`,
    playbookFor(text),
    `Tonight's lamps: ${JSON.stringify(current.lamps)}`,
    `Tonight's three moves: ${JSON.stringify(current.moves)}`,
    `Last decisions: ${JSON.stringify(current.decisions)}`,
    `Live board: ${JSON.stringify(snapshot)}`,
    'Answer in plain words. Hyphens only. Do not describe 4orm as an AI company. Do not invent a number or a name. A move is one line: verb, who, by when, plus a HOW of 2 to 4 steps. The regulator is a reach-out track and the lowest priority. Close friends-and-family to $250,000: $80,000 is in, $170,000 to go, in about seven $25,000 cheques. Next conversations: Kevin, Zahar, BJ, Daryl. Protect the product build. Pay the rest only as cash lands. Legal, securities, and tax go to counsel. Never say Sign. You advise. Chad decides.',
  ].filter(Boolean).join('\n\n');
  const anthropicKey = env('ANTHROPIC_API_KEY');
  const openaiKey = env('OPENAI_API_KEY');
  const model = env('CEO_MODEL');
  if (!anthropicKey && !openaiKey) return { reply: offlineReply(current.moves), wrote: false };
  let wrote = false;
  if (anthropicKey) {
    const messages: unknown[] = [{ role: 'user', content: text }];
    for (let round = 0; round < 3; round += 1) {
      const body = await anthropicTurn(anthropicKey, model || 'claude-sonnet-4-5', system, messages);
      if (!body?.content) return { reply: 'Counsel could not be reached.', wrote };
      const tools = body.content.filter((block) => block.type === 'tool_use');
      const reply = body.content.filter((block) => block.type === 'text').map((block) => block.text || '').join('\n').trim();
      if (!tools.length || body.stop_reason !== 'tool_use') return { reply: cleanReply(reply) || 'Counsel could not be reached.', wrote };
      messages.push({ role: 'assistant', content: body.content });
      const results = [];
      for (const tool of tools) {
        const result = await applyTool(sql, ownerId, String(tool.name || ''), tool.input || {});
        if (tool.name !== 'read_board') wrote = true;
        results.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result).slice(0, 8000) });
      }
      messages.push({ role: 'user', content: results });
    }
    return { reply: 'Counsel could not be reached.', wrote };
  }
  const messages: unknown[] = [{ role: 'user', content: text }];
  for (let round = 0; round < 3; round += 1) {
    const body = await openaiTurn(openaiKey, model || 'gpt-4o-mini', system, messages);
    const choice = body?.choices?.[0]?.message;
    if (!choice) return { reply: 'Counsel could not be reached.', wrote };
    const calls = choice.tool_calls || [];
    if (!calls.length) return { reply: cleanReply(choice.content || '') || 'Counsel could not be reached.', wrote };
    messages.push(choice);
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await applyTool(sql, ownerId, call.function.name, args);
      if (call.function.name !== 'read_board') wrote = true;
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 8000) });
    }
  }
  return { reply: 'Counsel could not be reached.', wrote };
}

/* ---------- 4IQ on the calendar: where the open work should go this week, from P13 (operating rhythm). ---------- */
export type SlotSuggestion = { day: string; start: string; minutes: number; title: string; why: string; principle: string };

function vanParts(ms: number) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, wd: String(p.weekday), hm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

export async function scheduleSuggest(sql: Sql, ownerId: string) {
  const files = loadCeoFiles();
  const now = Date.now();
  let events: Array<{ start: number; dur: number; title: string }> = [];
  try {
    events = ((await calendarPayload(sql, ownerId)) as Array<{ start: number; dur: number; title: string }>)
      .filter((ev) => ev.start >= now - 3600000 && ev.start <= now + 8 * 86400000 && (Number(ev.dur) || 0) < 600)
      .sort((a, b) => a.start - b.start).slice(0, 60);
  } catch (err) {
    fail('ceo_schedule_cal', err);
  }
  let work: Array<{ title: string; area: string; priority: string; due: string }> = [];
  try {
    const rows = await sql`
      SELECT title, area, priority, due FROM items
      WHERE owner_id = ${ownerId} AND status IN ('new', 'open', 'doing', 'waiting')
      ORDER BY (priority = 'urgent') DESC, (priority = 'high') DESC, due ASC NULLS LAST
      LIMIT 30
    `;
    work = (rows as Array<Record<string, unknown>>).map((r) => ({
      title: String(r.title || '').slice(0, 140), area: String(r.area || ''), priority: String(r.priority || ''),
      due: r.due ? vanParts(Date.parse(String(r.due))).day : '',
    }));
  } catch (err) {
    fail('ceo_schedule_items', err);
  }
  const ctx = await ceoContext(sql, ownerId).catch(() => null);
  const today = vanParts(now);
  const busy = events.map((ev) => { const a = vanParts(ev.start); return `${a.wd} ${a.day} ${a.hm} ${ev.dur}m ${String(ev.title).slice(0, 60)}`; }).join('\n');
  const todo = work.map((w) => `- ${w.title} [${w.area}, ${w.priority}${w.due ? `, due ${w.due}` : ''}]`).join('\n');
  const pipes = (ctx?.pipelines || []).map((p) => `${p.name}: ${p.total}`).join('; ');
  const system = [
    'You are 4IQ, the scheduling side of Chad Johnston\'s second CEO at 4orm Finance. Chad is in Vernon, BC (Pacific time). He sells to Canadian firms; Eastern is 3 hours ahead of Pacific.',
    'Place the open work into free time over the next 7 days, following the operating rhythm principle below exactly. Never overlap an existing event. Use 24-hour Pacific times on 15-minute marks. Never invent a meeting with another person; suggest blocks for Chad to do work (calls, email windows, build blocks, prep, follow-ups, weekly review).',
    'Also flag any existing event that breaks the rhythm (for example cold calls on Friday or over Eastern lunch, or a double booking) as a suggestion with title starting "Move:".',
    'Return JSON only: {"note": one sentence, "slots": [{"day":"YYYY-MM-DD","start":"HH:MM","minutes":number,"title":"under 60 characters","why":"one line, names the rule","principle":"P13 or another P number"}]}. 6 to 10 slots, earliest first.',
    '',
    files.principles.split('# P13')[1] ? '# P13' + files.principles.split('# P13')[1] : files.principles.slice(0, 6000),
  ].join('\n');
  const prompt = `Today is ${today.wd} ${today.day}, now ${today.hm} Pacific.\n\nCalendar (busy):\n${busy || '(empty)'}\n\nOpen work:\n${todo || '(none listed)'}\n\nPipelines: ${pipes || 'unknown'}\nRunway days: ${ctx?.runwayDays ?? 'unknown'}`;
  const raw = await dailyBrainJson(system, prompt);
  let parsed: { note?: string; slots?: unknown[] } = {};
  try {
    const t = String(raw || '');
    parsed = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  } catch {
    parsed = {};
  }
  const slots: SlotSuggestion[] = (Array.isArray(parsed.slots) ? parsed.slots : []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      day: /^\d{4}-\d{2}-\d{2}$/.test(String(r.day)) ? String(r.day) : '',
      start: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(r.start)) ? String(r.start) : '',
      minutes: Math.max(15, Math.min(240, Number(r.minutes) || 30)),
      title: String(r.title || '').replace(/[–—]/g, '-').slice(0, 80),
      why: String(r.why || '').replace(/[–—]/g, '-').slice(0, 200),
      principle: String(r.principle || 'P13').slice(0, 12),
    };
  }).filter((s) => s.day && s.start && s.title).slice(0, 12);
  return { note: String(parsed.note || '').replace(/[–—]/g, '-').slice(0, 300), slots, model: raw ? 'live' : 'none' };
}
