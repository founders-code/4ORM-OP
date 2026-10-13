import type { NeonQueryFunction } from '@neondatabase/serverless';
import { claimBudget } from './db';
import { allowPackageKind } from './guard.mjs';
import { copyDriveFile, createGmailDraft, driveWrite, uploadDriveBytes } from './google';
import { fail } from './log';
import { STARTERS, assembleMail, fillToken } from './packages.mjs';

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
};

type Person = { id: string; contactId: string; name: string; email: string; role: string; company: string; stage: string };

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
  };
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
    ['db_space_recipients_role', () => sql`ALTER TABLE space_recipients ADD COLUMN IF NOT EXISTS role text`],
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
    SELECT id, name, kind, notes, drive_folder_id, drive_folder_url, pushed_to_drive_at, created_at
    FROM spaces
    WHERE id = ${id} AND owner_id = ${ownerId}
    LIMIT 1
  `;
  return (rows[0] as Record<string, unknown> | undefined) || null;
}

async function readItems(sql: Sql, ownerId: string, spaceId: string): Promise<Item[]> {
  try {
    const rows = await sql`
      SELECT id, space_id, kind, name, url, mime, drive_file_id, thumb_url, body, parent_id, position
      FROM space_items
      WHERE space_id = ${spaceId} AND owner_id = ${ownerId}
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
      SELECT r.id, r.contact_id, r.name, r.email, r.role, c.company, c.stage
      FROM space_recipients r
      LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId}
      WHERE r.space_id = ${spaceId} AND r.owner_id = ${ownerId}
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
    }));
  } catch (err) {
    fail('spaces_people', err);
    return [];
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
    body: item.kind === 'note' ? item.body : '',
  }));
  const pushed = row.pushed_to_drive_at ? new Date(String(row.pushed_to_drive_at)) : null;
  const name = String(row.name || 'Untitled space');
  const starter = STARTERS.find((item) => item.name === name);
  return {
    id: String(row.id),
    name,
    kind: String(row.kind || starter?.kind || 'data_room'),
    status: 'draft',
    driveFolderId: row.drive_folder_id ? String(row.drive_folder_id) : '',
    driveFolderUrl: row.drive_folder_url ? String(row.drive_folder_url) : '',
    emailSubject: mail.subject || starter?.emailSubject || '',
    emailBody: mail.body || starter?.emailBody || '',
    research: starter?.research || '',
    spaceType: 'project',
    subjectContactId: '',
    subjectLabel: name,
    description: String(row.notes || ''),
    spaceCategory: '',
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
    return {
      ...view,
      space: { id: view.id, name: view.name, driveFolderId: view.driveFolderId, pushedToDriveAt: view.pushedToDriveAt },
      email: { subject: view.emailSubject, body: view.emailBody },
      package: view,
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
    const rows = await sql`
      SELECT id, name, kind, notes, drive_folder_id, drive_folder_url, pushed_to_drive_at, created_at
      FROM spaces
      WHERE owner_id = ${ownerId}
      ORDER BY created_at
    `;
    const cards = [];
    for (const row of rows as Record<string, unknown>[]) {
      const id = String(row.id);
      let docCount = 0;
      let recipientCount = 0;
      let preview = '';
      try {
        const docs = await sql`
          SELECT id FROM space_items
          WHERE space_id = ${id} AND owner_id = ${ownerId} AND coalesce(mime, '') <> 'text/x-folder'
        `;
        const people = await sql`SELECT id FROM space_recipients WHERE space_id = ${id} AND owner_id = ${ownerId}`;
        docCount = docs.length;
        recipientCount = people.length;
        const names = await sql`
          SELECT name FROM space_items
          WHERE space_id = ${id} AND owner_id = ${ownerId}
          ORDER BY position
          LIMIT 4
        `;
        preview = (names as Array<{ name?: string }>).map((row) => String(row.name || '')).filter(Boolean).join('\n');
      } catch (err) {
        fail('spaces_counts', err);
      }
      const pushed = row.pushed_to_drive_at ? new Date(String(row.pushed_to_drive_at)) : null;
      cards.push({
        id,
        name: String(row.name || 'Untitled space'),
        kind: String(row.kind || 'data_room'),
        status: 'draft',
        driveFolderUrl: row.drive_folder_url ? String(row.drive_folder_url) : '',
        spaceType: 'project',
        subjectLabel: String(row.name || ''),
        description: String(row.notes || ''),
        preview,
        pushedToDriveAt: pushed && !Number.isNaN(pushed.getTime()) ? pushed.toISOString() : '',
        docCount,
        recipientCount,
      });
    }
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
  if (name !== null || notes !== null || kind !== null) {
    await sql`
      UPDATE spaces SET
        name = CASE WHEN ${name !== null} THEN ${name || 'Untitled space'} ELSE name END,
        notes = CASE WHEN ${notes !== null} THEN ${notes || ''} ELSE notes END,
        kind = CASE WHEN ${kind !== null} THEN ${kind || 'data_room'} ELSE kind END,
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
  return readSpace(sql, ownerId, id);
}

export async function deleteSpace(sql: Sql, ownerId: string, id: string) {
  const row = await owned(sql, ownerId, id);
  if (!row) return false;
  try { await sql`DELETE FROM space_items WHERE space_id = ${id} AND owner_id = ${ownerId}`; } catch (err) { fail('spaces_delete_items', err); }
  try { await sql`DELETE FROM space_recipients WHERE space_id = ${id} AND owner_id = ${ownerId}`; } catch (err) { fail('spaces_delete_people', err); }
  try { await sql`DELETE FROM space_email WHERE space_id = ${id} AND owner_id = ${ownerId}`; } catch (err) { fail('spaces_delete_email', err); }
  await sql`DELETE FROM spaces WHERE id = ${id} AND owner_id = ${ownerId}`;
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
    body: item.kind === 'note' ? item.body : '',
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
  const kind = kindOf(input.kind, mime);
  const name = clip(input.name, 180) || (kind === 'link' ? clip(input.url, 180) : '') || (kind === 'note' ? 'Note' : 'Untitled file');
  let parent = clip(input.parent_id || input.parentId || input.folderId, 40);
  if (parent && !spaceIdOk(parent)) parent = '';
  if (parent) {
    const depth = await depthOf(sql, spaceId, parent);
    if (depth >= 3) parent = '';
  }
  const url = clip(input.url, 500);
  const driveFileId = clip(input.driveFileId || input.drive_file_id, 120);
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
  const siblings = await sql`
    SELECT position FROM space_items
    WHERE space_id = ${spaceId} AND owner_id = ${ownerId} AND parent_id IS NOT DISTINCT FROM ${parent || null}
    ORDER BY position DESC
    LIMIT 1
  `;
  const position = Number(siblings[0]?.position || 0) + 1;
  const rows = await sql`
    INSERT INTO space_items (space_id, owner_id, kind, name, url, mime, drive_file_id, thumb_url, body, parent_id, position)
    VALUES (${spaceId}, ${ownerId}, ${kind}, ${name}, ${url}, ${mime}, ${driveFileId}, ${thumb}, ${body}, ${parent || null}, ${position})
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
    WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId}
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
  const current = await sql`SELECT parent_id FROM space_items WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId} LIMIT 1`;
  if (!current.length) return readSpace(sql, ownerId, spaceId);
  const parent = current[0]?.parent_id ? String(current[0].parent_id) : null;
  await sql`UPDATE space_items SET parent_id = ${parent} WHERE space_id = ${spaceId} AND parent_id = ${itemId}`;
  await sql`DELETE FROM space_items WHERE id = ${itemId} AND space_id = ${spaceId} AND owner_id = ${ownerId}`;
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
  try {
    await sql`
      INSERT INTO space_recipients (owner_id, space_id, contact_id, name, email, role)
      VALUES (${ownerId}, ${spaceId}, ${contactId || null}, ${name}, ${email}, ${role})
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

export async function deleteSpaceRecipient(sql: Sql, ownerId: string, spaceId: string, recipientId: string) {
  if (!spaceIdOk(recipientId)) return null;
  const row = await owned(sql, ownerId, spaceId);
  if (!row) return null;
  await sql`DELETE FROM space_recipients WHERE id = ${recipientId} AND space_id = ${spaceId} AND owner_id = ${ownerId}`;
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
  if (!current.recipients.length) {
    return { prepared: false, note: 'Add a recipient before preparing a send.', package: current, drafts: [], manual: [] };
  }
  const drafts: Array<{ name: string; email: string; draftId: string }> = [];
  const manual: Array<{ name: string; email: string; subject: string; body: string; stage: string }> = [];
  let failed = false;
  for (const person of current.recipients) {
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
