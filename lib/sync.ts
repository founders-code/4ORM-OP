import type { NeonQueryFunction } from '@neondatabase/serverless';
import { allowArea, allowPriority, allowStatus, inferContactCategory, visibleCalendarWindow } from './guard.mjs';
import { claimBudget } from './db';
import { listEvents, listDriveTree, recentMail, googleConfigured, DRIVE_CALLS } from './google';
import { writePipelineCache } from './changes';
import { listContacts, listPipelines, listReminders, shapePipelineStages, ghlConfigured } from './ghl';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

const FRESH_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type CalEvent = { id: string; start: number; dur: number; title: string; color: string; join: string };

function asEvents(value: unknown): CalEvent[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return [];
  const rows: CalEvent[] = [];
  for (const event of parsed) {
    const row = event as Record<string, unknown>;
    const id = String(row.id || '');
    if (!id) continue;
    const join = String(row.join || '');
    rows.push({
      id,
      start: Number(row.start) || 0,
      dur: Number(row.dur) || 30,
      title: String(row.title || ''),
      color: '#2E6BF2',
      join: /^https?:\/\//i.test(join) ? join.slice(0, 500) : '',
    });
  }
  return rows;
}

async function pullEvents(sql: Sql, ownerId: string, timeMin: string, timeMax: string) {
  const events: CalEvent[] = [];
  let pageToken = '';
  let status: 'unavailable' | 'connected' | 'reached_empty' | 'stale' = 'reached_empty';
  for (let page = 0; page < 3; page += 1) {
    if (!(await claimBudget(sql, ownerId, 'google_calendar', 1))) {
      return { status: 'stale' as const, events, complete: false };
    }
    const result = await listEvents(timeMin, timeMax, pageToken);
    if (result.status === 'unavailable') {
      return { status: events.length ? ('connected' as const) : ('unavailable' as const), events, complete: false };
    }
    status = result.events.length ? 'connected' : result.status;
    for (const event of result.events) {
      if (event) events.push(event);
    }
    pageToken = result.nextPageToken || '';
    if (!pageToken) return { status, events, complete: true };
  }
  return { status, events, complete: !pageToken };
}

async function mark(sql: Sql, ownerId: string, source: string, status: string, detail: string) {
  await sql`
    INSERT INTO sync_state (owner_id, source, status, detail, synced_at)
    VALUES (${ownerId}, ${source}, ${status}, ${detail}, now())
    ON CONFLICT (owner_id, source)
    DO UPDATE SET status = EXCLUDED.status, detail = EXCLUDED.detail, synced_at = now()
  `;
}

export async function syncCalendar(sql: Sql, ownerId: string, force = false) {
  if (!googleConfigured()) {
    await mark(sql, ownerId, 'calendar', 'not_connected', 'Not connected.');
    return;
  }
  const window = visibleCalendarWindow();
  const prior = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = 'calendar'`;
  const cached = await sql`SELECT window_end FROM calendar_cache WHERE owner_id = ${ownerId}`;
  const age = prior[0]?.synced_at ? Date.now() - new Date(String(prior[0].synced_at)).getTime() : FRESH_MS + 1;
  const covered = cached[0]?.window_end ? new Date(String(cached[0].window_end)).getTime() >= window.end.getTime() - 1000 : false;
  if (!force && age < FRESH_MS && covered) return;
  const result = await pullEvents(sql, ownerId, window.start.toISOString(), window.end.toISOString());
  if (result.status === 'stale' || (result.status !== 'unavailable' && !result.complete)) {
    await mark(sql, ownerId, 'calendar', 'stale', 'Calendar refresh is waiting on the rate ceiling.');
    return;
  }
  await mark(sql, ownerId, 'calendar', result.status, result.events.length ? `${result.events.length} events` : 'No events in this range.');
  if (result.status !== 'unavailable') {
    await sql`
      INSERT INTO calendar_cache (owner_id, events, fetched_at, window_end)
      VALUES (${ownerId}, ${JSON.stringify(result.events)}::jsonb, now(), ${window.end.toISOString()})
      ON CONFLICT (owner_id) DO UPDATE SET events = EXCLUDED.events, fetched_at = now(), window_end = EXCLUDED.window_end
    `;
  }
}

export async function calendarMeta(sql: Sql, ownerId: string) {
  const rows = await sql`SELECT events, window_end FROM calendar_cache WHERE owner_id = ${ownerId}`;
  let events: CalEvent[] = [];
  try {
    events = asEvents(rows[0]?.events);
  } catch {
    events = [];
  }
  const until = rows[0]?.window_end ? new Date(String(rows[0].window_end)).getTime() : null;
  return { events, until: until && !Number.isNaN(until) ? until : null };
}

export async function calendarPayload(sql: Sql, ownerId: string) {
  return (await calendarMeta(sql, ownerId)).events;
}

export async function extendCalendar(sql: Sql, ownerId: string, fromMs: number, toMs: number) {
  const span = toMs - fromMs;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || span < 60 * 1000 || span > 56 * DAY_MS || toMs > Date.now() + 180 * DAY_MS) {
    return { ok: false as const };
  }
  const meta = await calendarMeta(sql, ownerId);
  if (meta.until && toMs <= meta.until + 1000) {
    return { ok: true as const, events: meta.events, until: meta.until };
  }
  if (!googleConfigured()) return { ok: true as const, events: meta.events, until: meta.until };
  const result = await pullEvents(sql, ownerId, new Date(fromMs).toISOString(), new Date(toMs).toISOString());
  if (result.status === 'unavailable' || result.status === 'stale' || !result.complete) return { ok: false as const };
  const byId = new Map<string, CalEvent>();
  for (const event of meta.events) byId.set(event.id, event);
  for (const event of result.events) byId.set(event.id, event);
  const merged = [...byId.values()];
  const untilIso = new Date(toMs).toISOString();
  await sql`
    INSERT INTO calendar_cache (owner_id, events, fetched_at, window_end)
    VALUES (${ownerId}, ${JSON.stringify(merged)}::jsonb, now(), ${untilIso})
    ON CONFLICT (owner_id) DO UPDATE SET
      events = EXCLUDED.events,
      fetched_at = now(),
      window_end = GREATEST(COALESCE(calendar_cache.window_end, EXCLUDED.window_end), EXCLUDED.window_end)
  `;
  return { ok: true as const, events: merged, until: toMs };
}

export async function syncDrive(sql: Sql, ownerId: string, force = false) {
  if (!googleConfigured()) {
    await mark(sql, ownerId, 'drive', 'not_connected', 'Not connected.');
    return;
  }
  const prior = await sql`SELECT fetched_at FROM drive_cache WHERE owner_id = ${ownerId}`;
  const age = prior[0]?.fetched_at ? Date.now() - new Date(String(prior[0].fetched_at)).getTime() : FRESH_MS + 1;
  if (!force && age < FRESH_MS) return;
  if (!(await claimBudget(sql, ownerId, 'google_drive', DRIVE_CALLS))) {
    await mark(sql, ownerId, 'drive', 'stale', 'Drive refresh is waiting on the rate ceiling.');
    return;
  }
  const tree = await listDriveTree();
  await mark(sql, ownerId, 'drive', tree.status, tree.drives.length ? `${tree.drives.length} drives` : 'No shared drives.');
  if (tree.status !== 'unavailable') {
    await sql`
      INSERT INTO drive_cache (owner_id, tree, fetched_at)
      VALUES (${ownerId}, ${JSON.stringify(tree.drives)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET tree = EXCLUDED.tree, fetched_at = now()
    `;
  }
}

export async function syncGhl(sql: Sql, ownerId: string, force = false) {
  try {
    if (!ghlConfigured()) {
      await mark(sql, ownerId, 'ghl', 'not_connected', 'Not connected.');
      return;
    }
    if (!force && (await isFresh(sql, ownerId, 'ghl'))) {
      const prior = await sql`SELECT status, detail FROM sync_state WHERE owner_id = ${ownerId} AND source = 'ghl'`;
      const stages = await sql`SELECT stage FROM pipeline_stages WHERE owner_id = ${ownerId} LIMIT 1`;
      const status = String(prior[0]?.status || '');
      const detail = String(prior[0]?.detail || '');
      if (stages.length || status === 'reached_empty' || status === 'not_connected') {
        const touched = await sql`SELECT id FROM contacts WHERE owner_id = ${ownerId} AND last_touch IS NOT NULL LIMIT 1`;
        if (touched.length || detail.includes('no touch dates') || status === 'reached_empty' || status === 'not_connected') return;
      }
    }
    if (!(await claimBudget(sql, ownerId, 'gohighlevel', 4))) {
      await mark(sql, ownerId, 'ghl', 'stale', 'GoHighLevel refresh is waiting on the rate ceiling.');
      return;
    }
    const contacts = await listContacts();
    if (contacts.status !== 'unavailable') {
      for (const contact of contacts.contacts) {
        const category = inferContactCategory(`${contact.company} ${contact.role} ${contact.name}`) === 'other' && contact.company
          ? 'business'
          : (inferContactCategory(`${contact.company} ${contact.role} ${contact.name}`) === 'other' && contact.email ? 'business' : inferContactCategory(`${contact.company} ${contact.role} ${contact.name}`));
        await sql`
          INSERT INTO contacts (owner_id, name, company, role, email, phone, area, source, source_id, category)
          VALUES (${ownerId}, ${contact.name}, ${contact.company}, ${contact.role}, ${contact.email}, ${contact.phone}, 'investors', 'ghl', ${contact.id}, ${category})
          ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
          DO UPDATE SET name = EXCLUDED.name, company = EXCLUDED.company, role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone,
            category = CASE WHEN contacts.category IS NULL OR contacts.category = '' OR contacts.category = 'other' THEN EXCLUDED.category ELSE contacts.category END
        `;
      }
    }
    const allPipes = await listPipelines();
    const stages = allPipes.status === 'unavailable' ? [] : shapePipelineStages(allPipes.pipelines);
    const touches: Array<{ sourceId: string; name: string; at: string }> = [];
    if (allPipes.status !== 'unavailable') {
      await writePipelineCache(sql, ownerId, allPipes.pipelines, stages);
      for (const pipeRow of allPipes.pipelines) {
        for (const stage of pipeRow.stages) {
          for (const opp of stage.opps) {
            if (opp.updatedAt && (opp.contactId || opp.contact)) touches.push({ sourceId: opp.contactId, name: opp.contact, at: opp.updatedAt });
          }
        }
      }
      touches.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    }
    const pipe = { status: allPipes.status, stages, touches: touches.slice(0, 120) };
    if (pipe.status === 'connected' || pipe.status === 'reached_empty') {
      for (const stage of pipe.stages) {
        await sql`
          INSERT INTO pipeline_stages (owner_id, stage, count, detail, updated_at)
          VALUES (${ownerId}, ${stage.stage}, ${stage.count}, ${stage.detail}, now())
          ON CONFLICT (owner_id, stage)
          DO UPDATE SET count = EXCLUDED.count, detail = EXCLUDED.detail, updated_at = now()
        `;
      }
      for (const touch of pipe.touches || []) {
        const at = new Date(touch.at);
        if (Number.isNaN(at.getTime())) continue;
        const iso = at.toISOString();
        if (touch.sourceId) {
          await sql`
            UPDATE contacts SET last_touch = ${iso}::timestamptz
            WHERE owner_id = ${ownerId} AND source = 'ghl' AND source_id = ${touch.sourceId}
              AND (last_touch IS NULL OR last_touch < ${iso}::timestamptz)
          `;
        }
        if (touch.name.length > 2) {
          await sql`
            UPDATE contacts SET last_touch = ${iso}::timestamptz
            WHERE owner_id = ${ownerId} AND lower(name) = lower(${touch.name})
              AND (last_touch IS NULL OR last_touch < ${iso}::timestamptz)
          `;
        }
      }
    }
    const failed = contacts.status === 'unavailable' || pipe.status === 'unavailable';
    if (failed) {
      await mark(sql, ownerId, 'ghl', 'stale', 'GHL sync failed');
    } else {
      const touchNote = (pipe.touches || []).length ? '' : ' no touch dates';
      const detail = (pipe.stages.length
        ? pipe.stages.map((stage) => `${stage.stage} ${stage.count}`).join(', ')
        : (contacts.contacts.length ? `${contacts.contacts.length} contacts` : 'No opportunities returned.')
      ).slice(0, 160) + touchNote;
      await mark(sql, ownerId, 'ghl', pipe.stages.length || contacts.contacts.length ? 'connected' : 'reached_empty', detail);
    }
    const reminders = await listReminders();
    await mark(sql, ownerId, 'ghl_tasks', reminders.status, reminders.status === 'unavailable' ? 'Reminders could not be read.' : `${reminders.tasks.length} reminders`);
    for (const task of reminders.tasks) {
      await sql`
        INSERT INTO items (owner_id, title, area, status, priority, due, source, source_id)
        VALUES (${ownerId}, ${task.title}, 'follow_up', 'new', 'normal', ${task.due}, 'ghl', ${task.id})
        ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET title = EXCLUDED.title, due = EXCLUDED.due, updated_at = now()
      `;
    }
  } catch (err) {
    fail('ghl_sync', err);
    try {
      await mark(sql, ownerId, 'ghl', 'stale', 'GHL sync failed');
    } catch (markErr) {
      fail('ghl_sync', markErr);
    }
  }
}

async function isFresh(sql: Sql, ownerId: string, source: string) {
  const prior = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = ${source}`;
  if (!prior[0]?.synced_at) return false;
  return Date.now() - new Date(String(prior[0].synced_at)).getTime() < FRESH_MS;
}

export async function ingestMail(sql: Sql, ownerId: string, force = false) {
  const empty = { titles: [] as string[], items: [] as Array<Record<string, string>> };
  if (!googleConfigured()) {
    await mark(sql, ownerId, 'gmail', 'not_connected', 'Not connected.');
    return empty;
  }
  if (!force && (await isFresh(sql, ownerId, 'gmail'))) return empty;
  if (!(await claimBudget(sql, ownerId, 'gmail', 9))) {
    await mark(sql, ownerId, 'gmail', 'stale', 'Mail refresh is waiting on the rate ceiling.');
    return empty;
  }
  const mail = await recentMail();
  await mark(sql, ownerId, 'gmail', mail.status, mail.messages.length ? `${mail.messages.length} messages` : 'No new subjects.');
  const titles: string[] = [];
  const items: Array<Record<string, string>> = [];
  for (const message of mail.messages) {
    const area = allowArea('outreach');
    const status = allowStatus('new');
    const priority = allowPriority('normal');
    if (!area || !status || !priority) continue;
    const rawFrom = String(message.from || '');
    const fromEmail = ((rawFrom.match(/<([^>]+)>/) || [])[1] || '').trim();
    if (fromEmail && message.at) {
      const iso = new Date(message.at).toISOString();
      await sql`
        UPDATE contacts SET last_touch = ${iso}::timestamptz
        WHERE owner_id = ${ownerId} AND lower(email) = lower(${fromEmail})
          AND (last_touch IS NULL OR last_touch < ${iso}::timestamptz)
      `;
    }
    items.push({ title: message.title, area, status, priority, source: 'gmail', source_id: message.id });
    const rows = await sql`
      INSERT INTO items (owner_id, title, area, status, priority, source, source_id)
      VALUES (${ownerId}, ${message.title}, ${area}, ${status}, ${priority}, 'gmail', ${message.id})
      ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
      DO UPDATE SET title = EXCLUDED.title, updated_at = now()
      RETURNING (created_at = updated_at) AS inserted, title
    `;
    if (rows[0]?.inserted) titles.push(String(rows[0].title));
  }
  return { titles, items };
}

export async function writeBrief(sql: Sql, ownerId: string, titles: string[], sources: string[]) {
  const top = titles.slice(0, 3).map((t) => ({ t }));
  const headline = titles[0] ? titles[0].slice(0, 140) : 'Nothing urgent on the desk';
  const summary = titles.length
    ? `${titles.length} open items need a look today.`
    : '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await sql`
    INSERT INTO daily_brief (owner_id, brief_date, headline, summary, top_three, sources)
    VALUES (${ownerId}, ${today}, ${headline}, ${summary}, ${JSON.stringify(top)}::jsonb, ${sources})
    ON CONFLICT (owner_id, brief_date)
    DO UPDATE SET headline = EXCLUDED.headline, summary = EXCLUDED.summary, top_three = EXCLUDED.top_three, sources = EXCLUDED.sources
  `;
  await mark(sql, ownerId, 'brief', 'connected', 'Filed for the morning.');
}
