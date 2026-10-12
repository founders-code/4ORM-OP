import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { allowArea, allowPriority, allowStatus, parseDue } from './guard.mjs';
import { env } from './env.mjs';
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
};

const ROOT = () => join(process.cwd(), 'ceo');

function readRel(rel: string) {
  const path = join(ROOT(), rel);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

export function loadCeoFiles() {
  const dir = ROOT();
  const principlesDir = join(dir, 'principles');
  const principles = existsSync(principlesDir)
    ? readdirSync(principlesDir)
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => readFileSync(join(principlesDir, name), 'utf8'))
        .join('\n\n')
    : '';
  return {
    persona: readRel('persona.md'),
    principles,
    profile: readRel('company-profile.md'),
    guardrails: readRel('config/guardrails.md'),
    voice: readRel('config/voice.md'),
    weights: readRel('config/weights.md'),
    lamps: readRel('config/lamps.md'),
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
  return name ? readRel(`playbooks/${name}`) : '';
}

function asDate(value: unknown) {
  if (!value) return null;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function shapeMove(row: MoveRow) {
  const principle = String(row.principle || '');
  return {
    id: String(row.id),
    rank: Number(row.rank) || 0,
    text: String(row.text || ''),
    principle,
    principleLabel: PRINCIPLES[principle as keyof typeof PRINCIPLES] || principle,
    whyNow: String(row.why_now || ''),
    area: String(row.area || 'other'),
    suggestedDue: asDate(row.suggested_due),
    status: String(row.status || 'open'),
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
  const moves = await sql`
    SELECT id, rank, text, principle, why_now, area, suggested_due, status, source_key
    FROM ceo_moves
    WHERE owner_id = ${ownerId} AND status = 'open'
    ORDER BY rank
    LIMIT 3
  `;
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
    WHERE owner_id = ${ownerId}
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
      INSERT INTO ceo_moves (owner_id, rank, text, principle, why_now, area, suggested_due, status, source_key)
      VALUES (${ownerId}, ${move.rank}, ${move.text}, ${move.principle}, ${move.whyNow}, ${move.area}, ${due}, 'open', ${move.sourceKey})
    `;
  }
  return readCeo(sql, ownerId);
}

export async function ensureCeo(sql: Sql, ownerId: string) {
  const current = await readCeo(sql, ownerId);
  if (!current.lamps.length && !current.moves.length) return refreshCeo(sql, ownerId);
  return current;
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

async function loadMove(sql: Sql, ownerId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql`
    SELECT id, rank, text, principle, why_now, area, suggested_due, status, source_key
    FROM ceo_moves
    WHERE id = ${id} AND owner_id = ${ownerId}
    LIMIT 1
  `;
  return (rows[0] as MoveRow | undefined) || null;
}

export async function doMove(sql: Sql, ownerId: string, id: string) {
  const move = await loadMove(sql, ownerId, id);
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
    SET status = 'done', snooze_until = now() + interval '3 days'
    WHERE id = ${move.id} AND owner_id = ${ownerId}
  `;
  await logDecision(sql, ownerId, move.id, {
    context: move.text,
    options: 'Do | Not now | Ask',
    evidence: move.why_now || '',
    caseAgainst: '',
    decision: 'Do',
    reviewDate: due,
  });
  return refreshCeo(sql, ownerId);
}

export async function snoozeMove(sql: Sql, ownerId: string, id: string, reason: string) {
  const move = await loadMove(sql, ownerId, id);
  const why = reason.trim().slice(0, 500);
  if (!move || move.status !== 'open' || !why) return null;
  await sql`
    UPDATE ceo_moves
    SET status = 'snoozed', snooze_until = now() + interval '3 days'
    WHERE id = ${move.id} AND owner_id = ${ownerId}
  `;
  await logDecision(sql, ownerId, move.id, {
    context: move.text,
    options: 'Do | Not now | Ask',
    evidence: move.why_now || '',
    caseAgainst: why,
    decision: 'Not now',
    reviewDate: new Date(Date.now() + 3 * 86400000).toISOString(),
  });
  return refreshCeo(sql, ownerId);
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
      FROM contacts WHERE owner_id = ${ownerId}
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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

export async function chatCeo(sql: Sql, ownerId: string, message: string) {
  const text = message.trim().slice(0, 2000);
  if (!text) return { reply: '', wrote: false };
  const current = await ensureCeo(sql, ownerId);
  const files = loadCeoFiles();
  const items = await sql`
    SELECT id, title, area, status, priority, due, owner
    FROM items WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC LIMIT 60
  `;
  const contacts = await sql`
    SELECT name, type, stage, next_action
    FROM contacts WHERE owner_id = ${ownerId}
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
    'Answer in plain words. Hyphens only. Do not describe 4orm as an AI company. Do not invent a number or a name. A move is one line: verb, who, by when. Legal, securities, and tax go to counsel. Never say Sign. You advise. Chad decides.',
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
