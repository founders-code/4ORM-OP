import type { NeonQueryFunction } from '@neondatabase/serverless';
import { allowArea, allowPriority, allowStatus } from './guard.mjs';
import { claimBudget } from './db';
import { listEvents, listDriveTree, recentMail, googleConfigured, DRIVE_CALLS } from './google';
import { listContacts, listPipeline, listReminders, ghlConfigured } from './ghl';

type Sql = NeonQueryFunction<false, false>;

const FRESH_MS = 10 * 60 * 1000;

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
    await mark(sql, ownerId, 'calendar', 'unavailable', 'Calendar is not connected.');
    return;
  }
  const prior = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = 'calendar'`;
  const age = prior[0]?.synced_at ? Date.now() - new Date(String(prior[0].synced_at)).getTime() : FRESH_MS + 1;
  if (!force && age < FRESH_MS) return;
  if (!(await claimBudget(sql, ownerId, 'google_calendar', 1))) {
    await mark(sql, ownerId, 'calendar', 'stale', 'Calendar refresh is waiting on the rate ceiling.');
    return;
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const result = await listEvents(start.toISOString(), end.toISOString());
  await mark(sql, ownerId, 'calendar', result.status, result.events.length ? `${result.events.length} events` : 'No events in this fortnight.');
  if (result.status !== 'unavailable') {
    await sql`
      INSERT INTO calendar_cache (owner_id, events, fetched_at)
      VALUES (${ownerId}, ${JSON.stringify(result.events)}::jsonb, now())
      ON CONFLICT (owner_id) DO UPDATE SET events = EXCLUDED.events, fetched_at = now()
    `;
  }
}

export async function calendarPayload(sql: Sql, ownerId: string) {
  const rows = await sql`SELECT events FROM calendar_cache WHERE owner_id = ${ownerId}`;
  const events = rows[0]?.events;
  if (Array.isArray(events)) return events;
  if (typeof events === 'string') {
    try {
      const parsed = JSON.parse(events);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function syncDrive(sql: Sql, ownerId: string, force = false) {
  if (!googleConfigured()) {
    await mark(sql, ownerId, 'drive', 'unavailable', 'Drive is not connected.');
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
  if (!ghlConfigured()) {
    await mark(sql, ownerId, 'ghl', 'unavailable', 'GoHighLevel is not connected.');
    return;
  }
  if (!force && (await isFresh(sql, ownerId, 'ghl'))) return;
  if (!(await claimBudget(sql, ownerId, 'gohighlevel', 4))) {
    await mark(sql, ownerId, 'ghl', 'stale', 'GoHighLevel refresh is waiting on the rate ceiling.');
    return;
  }
  const contacts = await listContacts();
  await mark(sql, ownerId, 'ghl', contacts.status, contacts.contacts.length ? `${contacts.contacts.length} contacts` : 'No contacts returned.');
  for (const contact of contacts.contacts) {
    await sql`
      INSERT INTO contacts (owner_id, name, company, role, email, phone, area, source, source_id)
      VALUES (${ownerId}, ${contact.name}, ${contact.company}, ${contact.role}, ${contact.email}, ${contact.phone}, 'investors', 'ghl', ${contact.id})
      ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
      DO UPDATE SET name = EXCLUDED.name, company = EXCLUDED.company, role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone
    `;
  }
  const pipe = await listPipeline();
  if (pipe.status === 'connected' || pipe.status === 'reached_empty') {
    await sql`DELETE FROM pipeline_stages WHERE owner_id = ${ownerId}`;
    for (const stage of pipe.stages) {
      await sql`
        INSERT INTO pipeline_stages (owner_id, stage, count, detail)
        VALUES (${ownerId}, ${stage.stage}, ${stage.count}, ${stage.detail})
      `;
    }
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
}

async function isFresh(sql: Sql, ownerId: string, source: string) {
  const prior = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = ${source}`;
  if (!prior[0]?.synced_at) return false;
  return Date.now() - new Date(String(prior[0].synced_at)).getTime() < FRESH_MS;
}

export async function ingestMail(sql: Sql, ownerId: string, force = false) {
  const empty = { titles: [] as string[], items: [] as Array<Record<string, string>> };
  if (!googleConfigured()) {
    await mark(sql, ownerId, 'gmail', 'unavailable', 'Mail is not connected.');
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
  const headline = titles[0] ? titles[0].slice(0, 140) : 'Nothing new reached the desk.';
  const summary = titles.length
    ? `${titles.length} items reached the desk this morning.`
    : 'The morning pull ran and found nothing new.';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await sql`
    INSERT INTO daily_brief (owner_id, brief_date, headline, summary, top_three, sources)
    VALUES (${ownerId}, ${today}, ${headline}, ${summary}, ${JSON.stringify(top)}::jsonb, ${sources})
    ON CONFLICT (owner_id, brief_date)
    DO UPDATE SET headline = EXCLUDED.headline, summary = EXCLUDED.summary, top_three = EXCLUDED.top_three, sources = EXCLUDED.sources
  `;
  await mark(sql, ownerId, 'brief', 'connected', 'Filed for the morning.');
}
