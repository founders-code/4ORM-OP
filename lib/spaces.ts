import type { NeonQueryFunction } from '@neondatabase/serverless';
import { claimBudget } from './db';
import { allowPackageKind } from './guard.mjs';
import { addGhlTask, ensureGhlContact, ghlConfigured, opportunityStages, pushOpportunity, repliedInbound, sendViaGhl } from './ghl';
import { copyDriveFile, createGmailDraft, driveWrite, uploadDriveBytes } from './google';
import { fail } from './log';
import { STARTERS, assembleMail, fillToken } from './packages-core.mjs';
import { TEST_SEND_TO, gateRealSend, spaceSendHash } from './send-gate.mjs';
import outreachSeed from '../data/spaces_seed.json';

type Sql = NeonQueryFunction<false, false>;

const ID = /^[0-9a-f-]{36}$/i;
const FILE_CAP = 4_000_000;
const KINDS = ['file', 'link', 'note', 'image'];

function clip(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

export function spaceIdOk(value: string) {
  return ID.test(value);
}

function kindOf(value: unknown, mime: string) {
  const key = clip(value, 20).toLowerCase();
  if (KINDS.includes(key)) return key;
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'text/uri-list') return 'link';
  if (mime === 'text/plain') return 'note';
  return 'file';
}

type Item = {
  id: string;
  spaceId: string;
  kind: string;
  name: string;
  url: string;
  mime: string;
  driveFileId: string;
  thumbUrl: string;
  body: string;
  parentId: string;
  position: number;
  createdAt?: string;
};

type Person = { id: string; contactId: string; name: string; email: string; role: string; company: string; stage: string; listed: boolean; sendStatus: string; addedAt?: string };

function asItem(row: Record<string, unknown>): Item {
  return {
    id: String(row.id),
    spaceId: String(row.space_id || ''),
    kind: String(row.kind || 'file'),
    name: String(row.name || ''),
    url: String(row.url || ''),
    mime: String(row.mime || ''),
    driveFileId: String(row.drive_file_id || ''),
    thumbUrl: String(row.thumb_url || ''),
    body: String(row.body || ''),
    parentId: row.parent_id ? String(row.parent_id) : '',
    position: Number(row.position || 0),
    createdAt: isoOf(row.created_at),
  };
}

function isoOf(value: unknown) {
  if (!value) return '';
  const at = new Date(String(value));
  return Number.isNaN(at.getTime()) ? '' : at.toISOString();
}

export async function ensureSpaceTables(sql: Sql) {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['db_spaces', () => sql`CREATE TABLE IF NOT EXISTS spaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      name text NOT NULL DEFAULT 'Untitled space',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      drive_folder_id text,
      pushed_to_drive_at timestamptz
    )`],
    ['db_spaces_kind', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'data_room'`],
    ['db_spaces_notes', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS notes text`],
    ['db_spaces_category', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS category text`],
    ['db_spaces_stage', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS stage text`],
    ['db_spaces_sent', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS sent_at timestamptz`],
    ['db_spaces_ghl', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS ghl_opportunity_id text`],
    ['db_spaces_drive_url', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS drive_folder_url text`],
    ['db_space_items', () => sql`CREATE TABLE IF NOT EXISTS space_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      space_id uuid NOT NULL,
      owner_id text NOT NULL,
      kind text NOT NULL DEFAULT 'file',
      name text NOT NULL DEFAULT '',
      url text,
      mime text,
      drive_file_id text,
      thumb_url text,
      body text,
      parent_id uuid,
      position int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_space_email', () => sql`CREATE TABLE IF NOT EXISTS space_email (
      space_id uuid PRIMARY KEY,
      owner_id text NOT NULL,
      subject text,
      body text
    )`],
    ['db_space_recipients', () => sql`CREATE TABLE IF NOT EXISTS space_recipients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      space_id uuid NOT NULL,
      contact_id text,
      name text NOT NULL DEFAULT '',
      email text,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
    ['db_space_recipients_role', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS role text`],
    ['db_space_recipients_listed', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT true`],
    ['db_space_recipients_send', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS send_status text`],
    ['db_spaces_deleted', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_space_items_deleted', () => sql`ALTER TABLE space_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_space_recipients_deleted', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS deleted_at timestamptz`],
    ['db_spaces_angle', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS angle text`],
    ['db_r2_spaces_steps', () => sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS steps jsonb`],
    ['db_r3_space_test_sends', () => sql`CREATE TABLE IF NOT EXISTS space_test_sends (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      space_id uuid NOT NULL,
      content_hash text NOT NULL,
      sent_to text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`],
  ];
  for (const [code, run] of steps) {
    try {
      await run();
    } catch (err) {
      fail(code, err);
    }
  }
}

async function owned(sql: Sql, ownerId: string, id: string) {
  if (!spaceIdOk(id)) return null;
  const rows = await sql`
    SELECT id, name, kind, notes, category, stage, drive_folder_id, drive_folder_url, pushed_to_drive_at, created_at,
      to_jsonb(spaces) ->> 'angle' AS angle,
      to_jsonb(spaces) -> 'steps' AS steps,
      to_jsonb(spaces) ->> 'sent_at' AS sent_at
    FROM spaces
    WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL
    LIMIT 1
  `;
  return (rows[0] as Record<string, unknown> | undefined) || null;
}

async function readItems(sql: Sql, ownerId: string, spaceId: string): Promise<Item[]> {
  try {
    const rows = await sql`
      SELECT id, space_id, kind, name, url, mime, drive_file_id, thumb_url, body, parent_id, position, created_at
      FROM space_items
      WHERE space_id = ${spaceId} AND owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY position, created_at
    `;
    return (rows as Record<string, unknown>[]).map(asItem);
  } catch (err) {
    fail('spaces_items', err);
    return [];
  }
}

async function readPeople(sql: Sql, ownerId: string, spaceId: string): Promise<Person[]> {
  try {
    const rows = await sql`
      SELECT r.id, r.contact_id, r.name, r.email, r.role, r.listed, r.send_status, r.created_at, c.company, c.stage
      FROM space_recipients r
      LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId}
      WHERE r.space_id = ${spaceId} AND r.owner_id = ${ownerId} AND r.deleted_at IS NULL
      ORDER BY r.name
    `;
    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      contactId: row.contact_id ? String(row.contact_id) : '',
      name: String(row.name || ''),
      email: String(row.email || ''),
      role: String(row.role || ''),
      company: String(row.company || ''),
      stage: String(row.stage || ''),
      listed: row.listed !== false,
      sendStatus: String(row.send_status || ''),
      addedAt: isoOf(row.created_at),
    }));
  } catch (err) {
    fail('spaces_people', err);
    try {
      const rows = await sql`
        SELECT r.id, r.contact_id, r.name, r.email, r.role, c.company, c.stage
        FROM space_recipients r
        LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId}
        WHERE r.space_id = ${spaceId} AND r.owner_id = ${ownerId} AND r.deleted_at IS NULL
        ORDER BY r.name
      `;
      return (rows as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        contactId: row.contact_id ? String(row.contact_id) : '',
        name: String(row.name || ''),
        email: String(row.email || ''),
        role: String(row.role || ''),
        company: String(row.company || ''),
        stage: String(row.stage || ''),
        listed: true,
        sendStatus: '',
      }));
    } catch (inner) {
      fail('spaces_people', inner);
      return [];
    }
  }
}

async function readMail(sql: Sql, ownerId: string, spaceId: string) {
  try {
    const rows = await sql`
      SELECT subject, body FROM space_email
      WHERE space_id = ${spaceId} AND owner_id = ${ownerId}
      LIMIT 1
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    return { subject: String(row?.subject || ''), body: String(row?.body || '') };
  } catch (err) {
    fail('spaces_email', err);
    return { subject: '', body: '' };
  }
}

function toView(row: Record<string, unknown>, items: Item[], people: Person[], mail: { subject: string; body: string }) {
  const folders = items.filter((item) => item.mime === 'text/x-folder').map((item) => ({
    id: item.id,
    parentId: item.parentId,
    name: item.name,
  }));
  const docs = items.filter((item) => item.mime !== 'text/x-folder').map((item) => ({
    id: item.id,
    driveFileId: item.driveFileId,
    name: item.name,
    url: item.url,
    mime: item.mime,
    uploaded: !!item.body,
    thumbUrl: item.thumbUrl,
    folderId: item.parentId,
    kind: item.kind,
    body: item.kind === 'note' || item.kind === 'link' ? item.body : '',
  }));
  const pushed = row.pushed_to_drive_at ? new Date(String(row.pushed_to_drive_at)) : null;
  const name = String(row.name || 'Untitled space');
  const starter = STARTERS.find((item) => item.name === name);
  return {
    id: String(row.id),
    name,
    kind: String(row.kind || starter?.kind || 'data_room'),
    status: String(row.stage || 'draft'),
    stage: String(row.stage || 'draft'),
    driveFolderId: row.drive_folder_id ? String(row.drive_folder_id) : '',
    driveFolderUrl: row.drive_folder_url ? String(row.drive_folder_url) : '',
    emailSubject: mail.subject || starter?.emailSubject || '',
    emailBody: mail.body || starter?.emailBody || '',
    research: starter?.research || '',
    spaceType: 'project',
    subjectContactId: '',
    subjectLabel: name,
    description: String(row.notes || ''),
    angle: String(row.angle || ''),
    spaceCategory: String(row.category || ''),
    pushedToDriveAt: pushed && !Number.isNaN(pushed.getTime()) ? pushed.toISOString() : '',
    docCount: docs.length,
    recipientCount: people.length,
    docs,
    folders,
    items,
    recipients: people,
    suggestions: starter?.suggestions || [],
  };
}

type Step = { t: string; d: boolean };

/** Next steps saved on the Space (spaces.steps jsonb): [{ t: text, d: done }]. */
function stepsOf(value: unknown): Step[] {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((step) => {
      const rec = (step && typeof step === 'object' ? step : {}) as Record<string, unknown>;
      return { t: clip(rec.t ?? rec.text, 200), d: rec.d === true || rec.done === true };
    })
    .filter((step) => step.t)
    .slice(0, 30);
}

type HistoryRow = { kind: 'created' | 'file' | 'link' | 'note' | 'person' | 'sent' | 'meeting' | 'email'; text: string; at: string };

/**
 * The Space's history from data already on the server: when it was made, what was attached, who was added,
 * when it was sent, meetings whose attendees include one of its people (zoom_notes), and cached inbox mail
 * from their addresses (inbox_cache). Newest first, at most 40 rows. Never calls Google or GHL.
 */
async function readHistory(sql: Sql, ownerId: string, row: Record<string, unknown>, items: Item[], people: Person[]): Promise<HistoryRow[]> {
  const out: HistoryRow[] = [];
  const created = isoOf(row.created_at);
  if (created) out.push({ kind: 'created', text: 'Space created', at: created });
  items.forEach((item) => {
    if (!item.createdAt || item.mime === 'text/x-folder') return;
    const kind = item.kind === 'link' ? 'link' : item.kind === 'note' ? 'note' : 'file';
    const verb = kind === 'link' ? 'Link added' : kind === 'note' ? 'Note added' : 'File attached';
    out.push({ kind, text: `${verb}: ${item.name || 'Untitled'}`, at: item.createdAt });
  });
  people.forEach((person) => {
    if (person.addedAt) out.push({ kind: 'person', text: `Added ${person.name || person.email || 'a person'}`, at: person.addedAt });
  });
  const sent = isoOf(row.sent_at);
  if (sent) out.push({ kind: 'sent', text: 'Bundle sent', at: sent });
  const names = people.map((person) => person.name.trim().toLowerCase()).filter((name) => name.length >= 3);
  const emails = people.map((person) => person.email.trim().toLowerCase()).filter((email) => email.includes('@'));
  if (names.length) {
    try {
      const patterns = names.map((name) => `%${name.replace(/[%_\\]/g, '')}%`);
      const meetings = await sql`
        SELECT title, note_date, created_at FROM zoom_notes
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND lower(attendees::text) LIKE ANY(${patterns}::text[])
        ORDER BY note_date DESC NULLS LAST
        LIMIT 10
      `;
      (meetings as Record<string, unknown>[]).forEach((m) => {
        const at = isoOf(m.note_date ? `${String(m.note_date).slice(0, 10)}T12:00:00Z` : m.created_at);
        if (at) out.push({ kind: 'meeting', text: `Meeting: ${String(m.title || 'Meeting')}`, at });
      });
    } catch (err) {
      fail('spaces_history_meetings', err);
    }
  }
  if (emails.length) {
    try {
      const cached = await sql`SELECT messages FROM inbox_cache WHERE owner_id = ${ownerId} LIMIT 1`;
      let messages: unknown = cached[0]?.messages;
      if (typeof messages === 'string') {
        try { messages = JSON.parse(messages); } catch { messages = []; }
      }
      (Array.isArray(messages) ? messages : []).forEach((msg) => {
        const rec = (msg && typeof msg === 'object' ? msg : {}) as Record<string, unknown>;
        const from = String(rec.email || '').trim().toLowerCase();
        if (!from || !emails.includes(from)) return;
        const at = isoOf(typeof rec.at === 'number' ? new Date(rec.at as number).toISOString() : rec.at);
        if (at) out.push({ kind: 'email', text: `Email from ${String(rec.from || from)}: ${String(rec.subject || '(no subject)').slice(0, 140)}`, at });
      });
    } catch (err) {
      fail('spaces_history_mail', err);
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

export async function readSpace(sql: Sql, ownerId: string, id: string) {
  try {
    const row = await owned(sql, ownerId, id);
    if (!row) return null;
    const [items, people, mail] = await Promise.all([
      readItems(sql, ownerId, id),
      readPeople(sql, ownerId, id),
      readMail(sql, ownerId, id),
    ]);
    const view = toView(row, items, people, mail);
    const history = await readHistory(sql, ownerId, row, items, people);
    return {
      ...view,
      steps: stepsOf(row.steps),
      history,
      sentAt: isoOf(row.sent_at),
      space: { id: view.id, name: view.name, driveFolderId: view.driveFolderId, pushedToDriveAt: view.pushedToDriveAt },
      email: { subject: view.emailSubject, body: view.emailBody },
    };
  } catch (err) {
    fail('spaces_read', err);
    return null;
  }
}

async function seedTemplates(sql: Sql, ownerId: string, taken: Set<string>) {
  for (const item of STARTERS) {
    if (taken.has(item.name)) continue;
    try {
      const found = await sql`SELECT id FROM spaces WHERE owner_id = ${ownerId} AND name = ${item.name} LIMIT 1`;
      if (found.length) continue;
      const rows = await sql`
        INSERT INTO spaces (owner_id, name, kind, notes, updated_at)
        VALUES (${ownerId}, ${item.name}, ${item.kind}, ${''}, now())
        RETURNING id
      `;
      const id = String(rows[0]?.id || '');
      if (!id) continue;
      await sql`
        INSERT INTO space_email (space_id, owner_id, subject, body)
        VALUES (${id}, ${ownerId}, ${item.emailSubject}, ${item.emailBody})
        ON CONFLICT (space_id) DO NOTHING
      `;
    } catch (err) {
      fail('spaces_seed', err);
    }
  }
}

function plain(value: string) {
  return value.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
}

async function insertRecipient(sql: Sql, ownerId: string, spaceId: string, who: string, role: string) {
  try {
    await sql`
      INSERT INTO space_recipients (owner_id, space_id, name, email, role, listed)
      VALUES (${ownerId}, ${spaceId}, ${who}, ${''}, ${role}, ${true})
    `;
  } catch (err) {
    fail('spaces_seed_person', err);
    try {
      await sql`
        INSERT INTO space_recipients (owner_id, space_id, name, email)
        VALUES (${ownerId}, ${spaceId}, ${who}, ${''})
      `;
    } catch (inner) {
      fail('spaces_seed_person', inner);
    }
  }
}

async function insertOutreachRow(sql: Sql, ownerId: string, item: Record<string, unknown>) {
  const name = clip(item.name, 120);
  if (!name) return;
  const kinds: Record<string, string> = { angel: 'investor', prospect: 'partner', regulator: 'regulator' };
  const kind = kinds[String(item.kind || '')] || 'data_room';
  const notes = plain((Array.isArray(item.intel) ? item.intel : []).map((line) => String(line || '').trim()).filter(Boolean).join('\n')).slice(0, 8000);
  const category = clip(item.category, 40);
  const role = clip(item.role, 120);
  let id = '';
  try {
    const rows = await sql`
      INSERT INTO spaces (owner_id, name, kind, notes, category, updated_at)
      VALUES (${ownerId}, ${name}, ${kind}, ${notes}, ${category}, now())
      RETURNING id
    `;
    id = String(rows[0]?.id || '');
  } catch (err) {
    fail('spaces_outreach', err);
    try {
      const rows = await sql`
        INSERT INTO spaces (owner_id, name, kind, notes, updated_at)
        VALUES (${ownerId}, ${name}, ${kind}, ${notes}, now())
        RETURNING id
      `;
      id = String(rows[0]?.id || '');
    } catch (inner) {
      fail('spaces_outreach', inner);
      try {
        const rows = await sql`
          INSERT INTO spaces (owner_id, name, updated_at)
          VALUES (${ownerId}, ${name}, now())
          RETURNING id
        `;
        id = String(rows[0]?.id || '');
      } catch (last) {
        fail('spaces_outreach', last);
        return;
      }
    }
  }
  if (!id) return;
  try {
    await sql`
      INSERT INTO space_email (space_id, owner_id, subject, body)
      VALUES (${id}, ${ownerId}, ${plain(clip(item.email_subject, 200))}, ${plain(clip(item.email_body, 8000))})
      ON CONFLICT (space_id) DO NOTHING
    `;
  } catch (err) {
    fail('spaces_seed', err);
  }
  const people = Array.isArray(item.people) ? item.people : [];
  for (const person of people) {
    const who = clip(person, 120);
    if (who) await insertRecipient(sql, ownerId, id, who, role);
  }
}

async function seedOutreach(sql: Sql, ownerId: string) {
  const entries = (outreachSeed.spaces || []) as Array<Record<string, unknown>>;
  let taken = new Set<string>();
  try {
    const rows = await sql`SELECT name FROM spaces WHERE owner_id = ${ownerId}`;
    taken = new Set((rows as Array<{ name?: string }>).map((row) => String(row.name || '')));
  } catch (err) {
    fail('spaces_seed_names', err);
  }
  const missing = entries.filter((item) => {
    const name = clip(item.name, 120);
    if (!name || taken.has(name)) return false;
    taken.add(name);
    return true;
  });
  const chunk = 8;
  for (let i = 0; i < missing.length; i += chunk) {
    await Promise.all(missing.slice(i, i + chunk).map((item) => insertOutreachRow(sql, ownerId, item)));
  }
}

async function pullGhlStages(sql: Sql, ownerId: string) {
  try {
    if (!ghlConfigured()) return;
    const board = await opportunityStages();
    if (!board.length) return;
    const rows = await sql`
      SELECT id, ghl_opportunity_id
      FROM spaces
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND coalesce(ghl_opportunity_id, '') <> ''
    `;
    const byId = new Map(board.map((row) => [row.id, row.stage]));
    for (const row of rows as Array<{ id: string; ghl_opportunity_id?: string }>) {
      const next = byId.get(String(row.ghl_opportunity_id || ''));
      if (!next) continue;
      await sql`
        UPDATE spaces SET stage = ${next}, updated_at = now()
        WHERE id = ${row.id} AND owner_id = ${ownerId} AND coalesce(stage, '') <> ${next}
      `;
    }
  } catch (err) {
    fail('spaces_ghl_pull', err);
  }
}

async function rememberOpportunity(sql: Sql, ownerId: string, id: string, stage: string) {
  try {
    if (!ghlConfigured()) return;
    const people = await readPeople(sql, ownerId, id);
    const person = people.find((row) => row.email);
    if (!person) return;
    const contactId = await ensureGhlContact({ name: person.name || 'Space', email: person.email, company: person.company });
    if (!contactId) return;
    const current = await sql`SELECT name, ghl_opportunity_id FROM spaces WHERE id = ${id} AND owner_id = ${ownerId} LIMIT 1`;
    const row = current[0] as { name?: string; ghl_opportunity_id?: string } | undefined;
    const opp = await pushOpportunity({
      name: String(row?.name || person.name || 'Space'),
      contactId,
      stage,
      opportunityId: String(row?.ghl_opportunity_id || ''),
    });
    if (!opp) return;
    await sql`UPDATE spaces SET ghl_opportunity_id = ${opp} WHERE id = ${id} AND owner_id = ${ownerId}`;
  } catch (err) {
    fail('spaces_ghl_push', err);
  }
}

const SIGN_OFF = '\n\nChad Johnston\n4orm Finance\nchad@4ormfinance.com';

/** What a real send would deliver, for the send gate: subject and body templates plus listed recipients. */
function sendContent(current: { emailSubject?: string; emailBody?: string; name?: string; recipients: Array<{ email?: string; listed?: boolean }> }) {
  return {
    subject: String(current.emailSubject || current.name || ''),
    body: String(current.emailBody || ''),
    recipients: current.recipients.filter((person) => person.listed !== false && person.email).map((person) => String(person.email)),
  };
}

async function hasTestSend(sql: Sql, ownerId: string, spaceId: string, hash: string) {
  const rows = await sql`
    SELECT 1 FROM space_test_sends
    WHERE owner_id = ${ownerId} AND space_id = ${spaceId}::uuid AND content_hash = ${hash}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Failure codes the route maps to HTTP statuses (test_required 409, no_recipients 400, not_connected 503, else 502). */
export type SpaceSendCode = 'not_found' | 'not_connected' | 'test_required' | 'no_recipients' | 'vendor';

export async function sendSpaceGhl(sql: Sql, ownerId: string, spaceId: string, flags: { docs?: boolean; links?: boolean; test?: boolean; to?: string }) {
  const current = await readSpace(sql, ownerId, spaceId);
  if (!current) return { sent: false, code: 'not_found' as SpaceSendCode, note: 'That space could not be read.' };
  if (!flags.test) {
    // Server-side send gate: the real send refuses unless a test of this exact content went to Chad first.
    const gate = await gateRealSend(sendContent(current), (hash: string) => hasTestSend(sql, ownerId, spaceId, hash));
    if (!gate.ok) {
      return { sent: false, code: 'test_required' as SpaceSendCode, note: `Send a test to ${TEST_SEND_TO} first. The email or the recipients changed since the last test.`, package: current };
    }
  }
  if (!ghlConfigured()) return { sent: false, code: 'not_connected' as SpaceSendCode, note: 'GoHighLevel is not connected. The email stays here.', package: current };
  if (flags.test) {
    const email = TEST_SEND_TO;
    const contactId = await ensureGhlContact({ name: 'Chad Johnston', email, company: '4orm' });
    const subject = `[TEST] ${current.emailSubject || current.name}`;
    let body = fillToken(current.emailBody || current.name, { name: 'Chad', email });
    if (!body.includes('chad@4ormfinance.com')) body += SIGN_OFF;
    const html = body.slice(0, 8000).replaceAll('\n', '<br>');
    const ok = contactId ? await sendViaGhl({ contactId, email, subject, html }) : false;
    if (ok) {
      try {
        await sql`
          INSERT INTO space_test_sends (owner_id, space_id, content_hash, sent_to)
          VALUES (${ownerId}, ${spaceId}::uuid, ${spaceSendHash(sendContent(current))}, ${email})
        `;
      } catch (err) {
        fail('spaces_test_record', err);
        return { sent: true, test: true, recorded: false, note: 'Test sent, but it could not be recorded. Send the test again before the real send.', package: current };
      }
    }
    return { sent: !!ok, test: true, code: ok ? undefined : ('vendor' as SpaceSendCode), note: ok ? 'Test sent to chad@4ormfinance.com' : 'GoHighLevel did not send the test.', package: current };
  }
  const people = current.recipients.filter((person) => person.listed !== false && person.email);
  if (!people.length) return { sent: false, code: 'no_recipients' as SpaceSendCode, note: 'Add a recipient with an email before sending.', package: current };
  const includeDocs = flags.docs !== false;
  const includeLinks = flags.links !== false;
  let sent = 0;
  for (const person of people) {
    const contactId = await ensureGhlContact({ name: person.name || current.name, email: person.email, company: person.company });
    const subject = fillToken(current.emailSubject || current.name, person);
    let body = fillToken(current.emailBody || '', person);
    if (includeDocs) {
      const lines = current.docs.filter((doc) => doc.kind !== 'link' && doc.mime !== 'text/x-folder').map((doc) => {
        const url = doc.driveFileId ? `https://drive.google.com/file/d/${doc.driveFileId}/view` : doc.url;
        return url ? `${doc.name} - ${url}` : doc.name;
      }).filter(Boolean);
      if (lines.length) body += `\n\nDocuments:\n${lines.join('\n')}`;
    }
    if (includeLinks) {
      const lines = current.docs.filter((doc) => doc.kind === 'link').map((doc) => (doc.url ? `${doc.name} - ${doc.url}` : doc.name)).filter(Boolean);
      if (lines.length) body += `\n\nLinks:\n${lines.join('\n')}`;
    }
    if (!body.includes('chad@4ormfinance.com')) body += SIGN_OFF;
    const html = body.slice(0, 8000).replaceAll('\n', '<br>');
    const ok = contactId ? await sendViaGhl({ contactId, email: person.email, subject, html }) : false;
    if (!ok) continue;
    sent += 1;
    try {
      let status = 'sent';
      if (contactId && await repliedInbound(contactId)) status = 'replied';
      await sql`UPDATE space_recipients SET send_status = ${status} WHERE id = ${person.id} AND space_id = ${spaceId} AND owner_id = ${ownerId}`;
    } catch (err) {
      fail('spaces_send_status', err);
    }
  }
  if (!sent) return { sent: false, code: 'vendor' as SpaceSendCode, note: 'GoHighLevel did not accept the send. Nothing was marked sent.', package: current };
  const next = await patchSpace(sql, ownerId, spaceId, { stage: 'sent' });
  return { sent: true, count: sent, note: 'Sent from chad@4ormfinance.com through GoHighLevel. Opens and replies update when GoHighLevel reports them.', package: next || current };
}

export async function followSpaceGhl(sql: Sql, ownerId: string, spaceId: string) {
  const current = await readSpace(sql, ownerId, spaceId);
  if (!current || !ghlConfigured()) return { ok: false, note: 'Follow up is on the desk. GoHighLevel is not connected.' };
  const person = current.recipients.find((row) => row.email);
  if (!person) return { ok: false, note: 'Follow up is on the desk.' };
  const contactId = await ensureGhlContact({ name: person.name || current.name, email: person.email, company: person.company });
  const ok = contactId ? await addGhlTask(contactId, `Follow up - ${current.name}`) : false;
  return { ok, note: ok ? 'Follow up is on the desk and in GoHighLevel.' : 'Follow up is on the desk. GoHighLevel did not take the task.' };
}

type SpaceCardMeta = {
  docCount: number;
  recipientCount: number;
  linkCount: number;
  preview: string;
  emailSubject: string;
  thumbs: Array<{ name: string; thumb: string }>;
};

function emptyMeta(): SpaceCardMeta {
  return { docCount: 0, recipientCount: 0, linkCount: 0, preview: '', emailSubject: '', thumbs: [] };
}

async function spaceCardMeta(sql: Sql, ownerId: string) {
  const byId = new Map<string, SpaceCardMeta>();
  try {
    const items = await sql`
      SELECT space_id, kind, name, thumb_url, mime
      FROM space_items
      WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY position, created_at
    `;
    for (const row of items as Array<Record<string, unknown>>) {
      const id = String(row.space_id || '');
      if (!id) continue;
      const meta = byId.get(id) || emptyMeta();
      const mime = String(row.mime || '');
      const folder = mime === 'text/x-folder';
      if (!folder) {
        meta.docCount += 1;
        if (String(row.kind || '') === 'link') meta.linkCount += 1;
        if (meta.thumbs.length < 6) {
          meta.thumbs.push({ name: String(row.name || ''), thumb: String(row.thumb_url || '') });
        }
      }
      const names = meta.preview ? meta.preview.split('\n') : [];
      if (names.length < 4 && row.name) names.push(String(row.name));
      meta.preview = names.join('\n');
      byId.set(id, meta);
    }
  } catch (err) {
    fail('spaces_counts', err);
  }
  try {
    const people = await sql`
      SELECT space_id FROM space_recipients WHERE owner_id = ${ownerId} AND deleted_at IS NULL
    `;
    for (const row of people as Array<{ space_id?: string }>) {
      const id = String(row.space_id || '');
      if (!id) continue;
      const meta = byId.get(id) || emptyMeta();
      meta.recipientCount += 1;
      byId.set(id, meta);
    }
  } catch (err) {
    fail('spaces_counts', err);
  }
  try {
    const mail = await sql`
      SELECT space_id, subject FROM space_email WHERE owner_id = ${ownerId}
    `;
    for (const row of mail as Array<{ space_id?: string; subject?: string }>) {
      const id = String(row.space_id || '');
      if (!id) continue;
      const meta = byId.get(id) || emptyMeta();
      meta.emailSubject = String(row.subject || '');
      byId.set(id, meta);
    }
  } catch (err) {
    fail('spaces_counts', err);
  }
  return byId;
}

export async function listSpaces(sql: Sql, ownerId: string) {
  try {
    await ensureSpaceTables(sql);
    let packages: Array<Record<string, unknown>> = [];
    try {
      const rows = await sql`
        SELECT id, name, kind, status, drive_folder_url
        FROM packages
        WHERE owner_id = ${ownerId}
        ORDER BY created_at
      `;
      packages = rows as Array<Record<string, unknown>>;
    } catch (err) {
      fail('spaces_list_packages', err);
    }
    await seedTemplates(sql, ownerId, new Set(packages.map((row) => String(row.name || ''))));
    await seedOutreach(sql, ownerId);
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await sql`
        SELECT id, name, kind, notes, category, stage, sent_at, drive_folder_id, drive_folder_url, pushed_to_drive_at, created_at,
          to_jsonb(spaces) ->> 'angle' AS angle
        FROM spaces
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        ORDER BY created_at
      ` as Record<string, unknown>[];
    } catch (err) {
      fail('spaces_list_cols', err);
      try {
        rows = await sql`
          SELECT id, name, kind, notes, created_at
          FROM spaces
          WHERE owner_id = ${ownerId} AND deleted_at IS NULL
          ORDER BY created_at
        ` as Record<string, unknown>[];
      } catch (inner) {
        fail('spaces_list', inner);
        rows = [];
      }
    }
    const meta = await spaceCardMeta(sql, ownerId);
    const cards = rows.map((row) => {
      const id = String(row.id);
      const bits = meta.get(id) || emptyMeta();
      const pushed = row.pushed_to_drive_at ? new Date(String(row.pushed_to_drive_at)) : null;
      return {
        id,
        name: String(row.name || 'Untitled space'),
        kind: String(row.kind || 'data_room'),
        status: String(row.stage || 'draft'),
        stage: String(row.stage || 'draft'),
        sentAt: row.sent_at ? String(row.sent_at) : '',
        driveFolderUrl: row.drive_folder_url ? String(row.drive_folder_url) : '',
        spaceType: 'project',
        subjectLabel: String(row.name || ''),
        description: String(row.notes || ''),
        angle: String(row.angle || ''),
        spaceCategory: String(row.category || ''),
        preview: bits.preview,
        emailSubject: bits.emailSubject,
        thumbs: bits.thumbs,
        linkCount: bits.linkCount,
        pushedToDriveAt: pushed && !Number.isNaN(pushed.getTime()) ? pushed.toISOString() : '',
        docCount: bits.docCount,
        recipientCount: bits.recipientCount,
      };
    });
    const names = new Set(cards.map((card) => card.name));
    const extras = packages.filter((row) => !names.has(String(row.name || '')));
    const merged = cards.concat(extras as typeof cards);
    return { spaces: merged, packages: merged };
  } catch (err) {
    fail('spaces_list', err);
    return { spaces: [], packages: [] };
  }
}

export async function createSpace(sql: Sql, ownerId: string, body: Record<string, unknown> | null) {
  await ensureSpaceTables(sql);
  const name = clip(body?.name || body?.title, 120) || 'Untitled space';
  const kind = allowPackageKind(String(body?.kind || '')) || 'data_room';
  const notes = clip(body?.notes || body?.description, 8000);
  let id = '';
  try {
    const rows = await sql`
      INSERT INTO spaces (owner_id, name, kind, notes, updated_at)
      VALUES (${ownerId}, ${name}, ${kind}, ${notes}, now())
      RETURNING id
    `;
    id = String(rows[0]?.id || '');
  } catch (err) {
    fail('spaces_create', err);
    const rows = await sql`
      INSERT INTO spaces (owner_id, name, updated_at)
      VALUES (${ownerId}, ${name}, now())
      RETURNING id
    `;
    id = String(rows[0]?.id || '');
  }
  if (!id) return null;
  try {
    await sql`
      INSERT INTO space_email (space_id, owner_id, subject, body)
      VALUES (${id}, ${ownerId}, ${clip(body?.emailSubject || body?.subject, 200)}, ${clip(body?.emailBody, 8000)})
      ON CONFLICT (space_id) DO NOTHING
    `;
  } catch (err) {
    fail('spaces_email', err);
  }
  const read = await readSpace(sql, ownerId, id);
  if (read) return read;
  return {
    id,
    name,
    kind,
    status: 'draft',
    docs: [],
    folders: [],
    items: [],
    recipients: [],
    docCount: 0,
    recipientCount: 0,
    description: notes,
    emailSubject: '',
    emailBody: '',
    driveFolderId: '',
    driveFolderUrl: '',
    pushedToDriveAt: '',
    spaceType: 'project',
    subjectLabel: name,
    suggestions: [],
    package: null,
    space: { id, name },
    email: { subject: '', body: '' },
  };
}

export async function patchSpace(sql: Sql, ownerId: string, id: string, body: Record<string, unknown>) {
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  const name = Object.prototype.hasOwnProperty.call(body, 'name') || Object.prototype.hasOwnProperty.call(body, 'title')
    ? (clip(body.name || body.title, 120) || 'Untitled space')
    : null;
  const notes = Object.prototype.hasOwnProperty.call(body, 'notes') || Object.prototype.hasOwnProperty.call(body, 'description')
    ? clip(body.notes ?? body.description, 8000)
    : null;
  const kind = Object.prototype.hasOwnProperty.call(body, 'kind') ? (allowPackageKind(String(body.kind || '')) || 'data_room') : null;
  const category = Object.prototype.hasOwnProperty.call(body, 'category') || Object.prototype.hasOwnProperty.call(body, 'spaceCategory')
    ? clip(body.category ?? body.spaceCategory, 80)
    : null;
  const stageRaw = Object.prototype.hasOwnProperty.call(body, 'stage') ? String(body.stage || '').toLowerCase() : '';
  const stage = stageRaw && ['draft', 'ready', 'sent', 'replied', 'meeting', 'committed'].includes(stageRaw) ? stageRaw : (stageRaw ? 'draft' : null);
  if (name !== null || notes !== null || kind !== null || category !== null || stage !== null) {
    await sql`
      UPDATE spaces SET
        name = CASE WHEN ${name !== null} THEN ${name || 'Untitled space'} ELSE name END,
        notes = CASE WHEN ${notes !== null} THEN ${notes || ''} ELSE notes END,
        kind = CASE WHEN ${kind !== null} THEN ${kind || 'data_room'} ELSE kind END,
        category = CASE WHEN ${category !== null} THEN ${category || ''} ELSE category END,
        stage = CASE WHEN ${stage !== null} THEN ${stage || 'draft'} ELSE stage END,
        sent_at = CASE WHEN ${stage === 'sent'} THEN now() ELSE sent_at END,
        updated_at = now()
      WHERE id = ${id} AND owner_id = ${ownerId}
    `;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'emailSubject') || Object.prototype.hasOwnProperty.call(body, 'emailBody') || Object.prototype.hasOwnProperty.call(body, 'subject') || Object.prototype.hasOwnProperty.call(body, 'body')) {
    const current = await readMail(sql, ownerId, id);
    const subject = Object.prototype.hasOwnProperty.call(body, 'emailSubject') || Object.prototype.hasOwnProperty.call(body, 'subject')
      ? clip(body.emailSubject ?? body.subject, 200)
      : current.subject;
    const emailBody = Object.prototype.hasOwnProperty.call(body, 'emailBody') || Object.prototype.hasOwnProperty.call(body, 'body')
      ? clip(body.emailBody ?? body.body, 8000)
      : current.body;
    await saveEmail(sql, ownerId, id, subject, emailBody);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'angle')) {
    // The angle is its own field; it never touches notes.
    const angle = clip(body.angle, 4000);
    try {
      await sql`UPDATE spaces SET angle = ${angle}, updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
    } catch (err) {
      // Column not there yet on this database: add it (additive) and try once more.
      fail('spaces_angle', err);
      await sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS angle text`;
      await sql`UPDATE spaces SET angle = ${angle}, updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'steps')) {
    // Next steps live on the Space (spaces.steps jsonb), not in this browser.
    const steps = JSON.stringify(stepsOf(body.steps));
    try {
      await sql`UPDATE spaces SET steps = ${steps}::jsonb, updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
    } catch (err) {
      fail('spaces_steps', err);
      await sql`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS steps jsonb`;
      await sql`UPDATE spaces SET steps = ${steps}::jsonb, updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
    }
  }
  if (stage) await rememberOpportunity(sql, ownerId, id, stage);
  return readSpace(sql, ownerId, id);
}

export async function deleteSpace(sql: Sql, ownerId: string, id: string) {
  const row = await owned(sql, ownerId, id);
  if (!row) return false;
  // Soft delete: the space disappears from every read; its items, people and email stay for a restore.
  await sql`UPDATE spaces SET deleted_at = now() WHERE id = ${id} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  return true;
}

async function depthOf(sql: Sql, spaceId: string, itemId: string) {
  let depth = 1;
  let current = itemId;
  const seen = new Set<string>();
  while (current && depth < 8) {
    if (seen.has(current)) return 99;
    seen.add(current);
    const rows = await sql`SELECT parent_id FROM space_items WHERE id = ${current} AND space_id = ${spaceId} LIMIT 1`;
    const parent = rows[0]?.parent_id ? String(rows[0].parent_id) : '';
    if (!parent) return depth;
    depth += 1;
    current = parent;
  }
  return depth;
}

function shapeItem(item: Item) {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    url: item.url,
    mime: item.mime,
    driveFileId: item.driveFileId,
    thumb_url: item.thumbUrl,
    thumbUrl: item.thumbUrl,
    body: item.kind === 'note' || item.kind === 'link' ? item.body : '',
    parent_id: item.parentId || null,
    parentId: item.parentId,
    position: item.position,
  };
}

export async function addSpaceItem(
  sql: Sql,
  ownerId: string,
  spaceId: string,
  input: Record<string, unknown>,
  bytes?: Buffer,
) {
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  const mime = clip(input.mime, 120) || (bytes ? 'application/octet-stream' : '');
  const asked = clip(input.kind, 20).toLowerCase();
  const folder = asked === 'folder' || mime === 'text/x-folder';
  const kind = folder ? 'note' : kindOf(input.kind, mime);
  const name = clip(input.name, 180) || (kind === 'link' ? clip(input.url, 180) : '') || (folder ? 'Untitled folder' : kind === 'note' ? 'Note' : 'Untitled file');
  let parent = clip(input.parent_id || input.parentId || input.folderId, 40);
  if (parent && !spaceIdOk(parent)) parent = '';
  if (parent) {
    const depth = await depthOf(sql, spaceId, parent);
    if (depth >= 3) parent = '';
  }
  const storedMime = folder ? 'text/x-folder' : mime;
  let url = clip(input.url, 500);
  let driveFileId = clip(input.driveFileId || input.drive_file_id, 120);
  let body = kind === 'note' ? clip(input.body, 8000) : '';
  let thumb = clip(input.thumbUrl || input.thumb_url, 200000);
  if (bytes) {
    if (!bytes.length || bytes.length > FILE_CAP) return null;
    body = bytes.toString('base64');
    if (mime.startsWith('image/') && body.length < 120000) thumb = `data:${mime};base64,${body}`;
  } else if (typeof input.dataUrl === 'string' && input.dataUrl.startsWith('data:')) {
    const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const data = match[2].slice(0, FILE_CAP);
      body = data;
      if ((match[1] || mime).startsWith('image/') && data.length < 120000) thumb = input.dataUrl.slice(0, 200000);
    }
  }
  if (bytes && !driveFileId && /officedocument|msword|ms-excel|ms-powerpoint/.test(mime)) {
    try {
      const cached = await sql`SELECT tree FROM drive_cache WHERE owner_id = ${ownerId}`;
      let tree: unknown = (cached[0] as { tree?: unknown } | undefined)?.tree;
      if (typeof tree === 'string') {
        try { tree = JSON.parse(tree); } catch { tree = []; }
      }
      const parentId = String((Array.isArray(tree) ? (tree[0] as { id?: string } | null) : null)?.id || '');
      if (/^[\w-]{8,}$/.test(parentId)) {
        const uploaded = await uploadDriveBytes(name, mime, parentId, bytes) as { id?: string } | null;
        driveFileId = clip(uploaded?.id, 120);
        if (driveFileId && !url) url = `https://drive.google.com/file/d/${driveFileId}/preview`;
      }
    } catch (err) {
      fail('spaces_office', err);
    }
  }
  const siblings = await sql`
    SELECT position FROM space_items
    WHERE space_id = ${spaceId} AND owner_id = ${ownerId} AND deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM ${parent || null}
    ORDER BY position DESC
    LIMIT 1
  `;
  const position = Number(siblings[0]?.position || 0) + 1;
  const rows = await sql`
    INSERT INTO space_items (space_id, owner_id, kind, name, url, mime, drive_file_id, thumb_url, body, parent_id, position)
    VALUES (${spaceId}, ${ownerId}, ${kind}, ${name}, ${url}, ${storedMime}, ${driveFileId}, ${thumb}, ${body}, ${parent || null}, ${position})
    RETURNING id, space_id, kind, name, url, mime, drive_file_id, thumb_url, body, parent_id, position
  `;
  await sql`UPDATE spaces SET updated_at = now() WHERE id = ${spaceId} AND owner_id = ${ownerId}`;
  const item = asItem(rows[0] as Record<string, unknown>);
  const view = await readSpace(sql, ownerId, spaceId);
  return { item: shapeItem(item), package: view, ...(view || {}) };
}

export async function patchSpaceItem(sql: Sql, ownerId: string, spaceId: string, itemId: string, body: Record<string, unknown>) {
  if (!spaceIdOk(itemId)) return null;
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  const current = await sql`
    SELECT id, parent_id FROM space_items
    WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId} AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!current.length) return null;
  const setName = Object.prototype.hasOwnProperty.call(body, 'name');
  const setBody = Object.prototype.hasOwnProperty.call(body, 'body');
  const setParent = Object.prototype.hasOwnProperty.call(body, 'parent_id') || Object.prototype.hasOwnProperty.call(body, 'parentId');
  const setPosition = Object.prototype.hasOwnProperty.call(body, 'position');
  const name = setName ? (clip(body.name, 180) || 'Untitled') : '';
  const note = setBody ? clip(body.body, 8000) : '';
  let parent = setParent ? clip(body.parent_id ?? body.parentId, 40) : '';
  if (setParent && parent === itemId) parent = '';
  if (setParent && parent && !spaceIdOk(parent)) parent = '';
  if (setParent && parent) {
    const depth = await depthOf(sql, spaceId, parent);
    if (depth >= 3) parent = String(current[0]?.parent_id || '');
  }
  const position = setPosition ? Number(body.position || 0) : 0;
  await sql`
    UPDATE space_items SET
      name = CASE WHEN ${setName} THEN ${name} ELSE name END,
      body = CASE WHEN ${setBody} THEN ${note} ELSE body END,
      parent_id = CASE WHEN ${setParent} THEN ${parent || null} ELSE parent_id END,
      position = CASE WHEN ${setPosition} THEN ${position} ELSE position END
    WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId}
  `;
  return readSpace(sql, ownerId, spaceId);
}

export async function deleteSpaceItem(sql: Sql, ownerId: string, spaceId: string, itemId: string) {
  if (!spaceIdOk(itemId)) return null;
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  const current = await sql`SELECT parent_id FROM space_items WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId} AND deleted_at IS NULL LIMIT 1`;
  if (!current.length) return readSpace(sql, ownerId, spaceId);
  const parent = current[0]?.parent_id ? String(current[0].parent_id) : null;
  await sql`UPDATE space_items SET parent_id = ${parent} WHERE space_id = ${spaceId} AND parent_id = ${itemId} AND deleted_at IS NULL`;
  await sql`UPDATE space_items SET deleted_at = now() WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  return readSpace(sql, ownerId, spaceId);
}

export async function addSpaceRecipient(sql: Sql, ownerId: string, spaceId: string, input: Record<string, unknown>) {
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  let name = clip(input.name, 120);
  let email = clip(input.email, 180);
  let role = clip(input.role, 120);
  const contactId = clip(input.contactId || input.contact_id, 40);
  if (contactId && spaceIdOk(contactId)) {
    const contacts = await sql`SELECT name, email, role, company FROM contacts WHERE id = ${contactId} AND owner_id = ${ownerId}`;
    const contact = contacts[0] as Record<string, unknown> | undefined;
    if (contact) {
      name = clip(contact.name, 120) || name;
      email = clip(contact.email, 180);
      role = clip(contact.role, 120) || role;
    }
  }
  if (!name) name = 'Recipient';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';
  const listed = input.listed !== false && input.listed !== 'false';
  try {
    await sql`
      INSERT INTO space_recipients (owner_id, space_id, contact_id, name, email, role, listed)
      VALUES (${ownerId}, ${spaceId}, ${contactId || null}, ${name}, ${email}, ${role}, ${listed})
    `;
  } catch (err) {
    fail('spaces_recipient', err);
    await sql`
      INSERT INTO space_recipients (owner_id, space_id, contact_id, name, email)
      VALUES (${ownerId}, ${spaceId}, ${contactId || null}, ${name}, ${email})
    `;
  }
  return readSpace(sql, ownerId, spaceId);
}

export async function listSpaceRecipient(sql: Sql, ownerId: string, spaceId: string, recipientId: string) {
  if (!spaceIdOk(recipientId)) return null;
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  try {
    await sql`UPDATE space_recipients SET listed = true WHERE id = ${recipientId} AND space_id = ${spaceId} AND owner_id = ${ownerId}`;
  } catch (err) {
    fail('spaces_recipient', err);
  }
  return readSpace(sql, ownerId, spaceId);
}

export async function deleteSpaceRecipient(sql: Sql, ownerId: string, spaceId: string, recipientId: string) {
  if (!spaceIdOk(recipientId)) return null;
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  await sql`UPDATE space_recipients SET deleted_at = now() WHERE id = ${recipientId} AND space_id = ${spaceId} AND owner_id = ${ownerId} AND deleted_at IS NULL`;
  return readSpace(sql, ownerId, spaceId);
}

export async function saveEmail(sql: Sql, ownerId: string, spaceId: string, subject: string, body: string) {
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  const cleanSubject = clip(subject, 200);
  const cleanBody = clip(body, 8000);
  await sql`
    INSERT INTO space_email (space_id, owner_id, subject, body)
    VALUES (${spaceId}, ${ownerId}, ${cleanSubject}, ${cleanBody})
    ON CONFLICT (space_id) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body
  `;
  return readSpace(sql, ownerId, spaceId);
}

async function driveRoot(sql: Sql, ownerId: string) {
  try {
    const cached = await sql`SELECT tree FROM drive_cache WHERE owner_id = ${ownerId}`;
    let raw: unknown = cached[0]?.tree;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { raw = []; }
    }
    const tree = Array.isArray(raw) ? raw : [];
    const id = String((tree[0] as { id?: string } | undefined)?.id || '');
    return /^[\w-]{8,}$/.test(id) ? id : '';
  } catch (err) {
    fail('spaces_drive_root', err);
    return '';
  }
}

export async function moveSpaceToDrive(sql: Sql, ownerId: string, spaceId: string) {
  const current = await readSpace(sql, ownerId, spaceId);
  if (!current) return null;
  const parentId = await driveRoot(sql, ownerId);
  if (!parentId) {
    return { ok: false, error: 'Drive has no shared drive to receive this Space. The staged files are still here.', package: current };
  }
  const weight = 1 + current.folders.length + current.docs.length;
  if (!(await claimBudget(sql, ownerId, 'google_drive', Math.min(Math.max(weight, 1), 40)))) {
    return { ok: false, error: 'Drive is busy. The staged files are still here.', package: current };
  }
  const root = (await driveWrite('mkdir', { name: current.name, parentId })) as { id?: string; webViewLink?: string } | null;
  if (!root?.id) return { ok: false, error: 'Drive could not take this Space. The staged files are still here.', package: current };
  const folderMap: Record<string, string> = {};
  for (const folder of current.folders) {
    const made = (await driveWrite('mkdir', {
      name: folder.name,
      parentId: folder.parentId ? folderMap[folder.parentId] || String(root.id) : String(root.id),
    })) as { id?: string } | null;
    if (made?.id) folderMap[folder.id] = String(made.id);
  }
  for (const doc of current.docs) {
    const dest = doc.folderId && folderMap[doc.folderId] ? folderMap[doc.folderId] : String(root.id);
    if (doc.driveFileId && /^[\w-]{8,}$/.test(doc.driveFileId)) {
      await copyDriveFile(doc.driveFileId, dest, doc.name);
      continue;
    }
    if (!doc.uploaded) continue;
    const stored = await sql`SELECT body FROM space_items WHERE id = ${doc.id} AND space_id = ${spaceId} AND owner_id = ${ownerId}`;
    const b64 = String((stored[0] as { body?: string } | undefined)?.body || '');
    if (!b64) continue;
    await uploadDriveBytes(doc.name, doc.mime, dest, Buffer.from(b64, 'base64'));
  }
  const url = String(root.webViewLink || '') || `https://drive.google.com/drive/folders/${root.id}`;
  await sql`
    UPDATE spaces
    SET drive_folder_id = ${String(root.id)}, drive_folder_url = ${url}, pushed_to_drive_at = now(), updated_at = now()
    WHERE id = ${spaceId} AND owner_id = ${ownerId}
  `;
  const next = await readSpace(sql, ownerId, spaceId);
  return { ok: true, error: '', package: next || current };
}

export async function sendSpace(sql: Sql, ownerId: string, spaceId: string) {
  const current = await readSpace(sql, ownerId, spaceId);
  if (!current) return null;
  const mailPeople = current.recipients.filter((person) => person.listed !== false);
  if (!mailPeople.length) {
    return { prepared: false, note: 'Add a recipient before preparing a send.', package: current, drafts: [], manual: [] };
  }
  const drafts: Array<{ name: string; email: string; draftId: string }> = [];
  const manual: Array<{ name: string; email: string; subject: string; body: string; stage: string }> = [];
  let failed = false;
  for (const person of mailPeople) {
    const subject = fillToken(current.emailSubject, person);
    const body = assembleMail(current, person);
    if (!person.email) {
      manual.push({ name: person.name, email: '', subject, body, stage: person.stage });
      continue;
    }
    const allowed = await claimBudget(sql, ownerId, 'gmail', 1);
    const draftId = allowed ? await createGmailDraft(person.email, subject, body) : null;
    if (draftId) drafts.push({ name: person.name, email: person.email, draftId: String(draftId) });
    else {
      failed = true;
      manual.push({ name: person.name, email: person.email, subject, body, stage: person.stage });
    }
  }
  const missing = current.recipients.some((person) => !person.email);
  const note = !drafts.length && missing && !failed
    ? 'No email on file. Copy the note below, or add the address from Contacts.'
    : !drafts.length
      ? 'Gmail could not open a draft. Reconnect Google if drafts should be created, or copy the note below.'
      : failed || missing
        ? 'Drafts were opened where an email was on file. Copy the note for anyone still waiting.'
        : 'Gmail drafts are ready for review. Nothing was sent.';
  return { prepared: true, note, status: current.status, drafts, manual, package: current };
}

export async function addSpaceFolder(sql: Sql, ownerId: string, spaceId: string, name: string, parentId: string) {
  return addSpaceItem(sql, ownerId, spaceId, {
    kind: 'note',
    name: clip(name, 120) || 'Untitled folder',
    mime: 'text/x-folder',
    parentId,
    body: '',
  });
}
