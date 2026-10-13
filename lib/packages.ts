import type { NeonQueryFunction } from '@neondatabase/serverless';
import { allowPackageKind, allowPackageStatus } from './guard.mjs';
import { STARTERS, assembleMail, fillToken } from './packages.mjs';
import { claimBudget } from './db';
import { createGmailDraft, driveWrite, listFolderFiles } from './google';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

const ID = /^[0-9a-f-]{36}$/i;

export function packageIdOk(value: string) {
  return ID.test(value);
}

function clip(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

type Doc = { id: string; driveFileId: string; name: string; url: string; mime: string };
type Recipient = { id: string; contactId: string; name: string; email: string; role: string; company: string; stage: string };

function shapePackage(row: Record<string, unknown>, docs: Doc[], recipients: Recipient[]) {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    kind: String(row.kind || ''),
    driveFolderId: row.drive_folder_id ? String(row.drive_folder_id) : '',
    driveFolderUrl: row.drive_folder_url ? String(row.drive_folder_url) : '',
    emailSubject: String(row.email_subject || ''),
    emailBody: String(row.email_body || ''),
    research: String(row.research || ''),
    status: String(row.status || 'draft'),
    docCount: docs.length,
    recipientCount: recipients.length,
    docs,
    recipients,
    suggestions: STARTERS.find((item) => item.name === String(row.name || ''))?.suggestions || [],
  };
}

async function readDocs(sql: Sql, packageId: string): Promise<Doc[]> {
  const rows = await sql`
    SELECT id, drive_file_id, name, url, mime
    FROM package_docs
    WHERE package_id = ${packageId}
    ORDER BY name
  `;
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    driveFileId: String(row.drive_file_id || ''),
    name: String(row.name || ''),
    url: String(row.url || ''),
    mime: String(row.mime || ''),
  }));
}

async function readRecipients(sql: Sql, ownerId: string, packageId: string): Promise<Recipient[]> {
  const rows = await sql`
    SELECT r.id, r.contact_id, r.name, r.email, r.role, c.company, c.stage
    FROM package_recipients r
    LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId}
    WHERE r.package_id = ${packageId}
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
}

export async function listPackages(sql: Sql, ownerId: string) {
  try {
    const count = await sql`SELECT id FROM packages WHERE owner_id = ${ownerId} LIMIT 1`;
    if (!count.length) await seedPackages(sql, ownerId);
    const rows = await sql`
      SELECT id, name, kind, status, drive_folder_url
      FROM packages
      WHERE owner_id = ${ownerId}
      ORDER BY created_at
    `;
    const out = [];
    for (const row of rows as Record<string, unknown>[]) {
      const id = String(row.id);
      let docCount = 0;
      let recipientCount = 0;
      try {
        const docs = await sql`SELECT id FROM package_docs WHERE package_id = ${id}`;
        const people = await sql`SELECT id FROM package_recipients WHERE package_id = ${id}`;
        docCount = docs.length;
        recipientCount = people.length;
      } catch (err) {
        fail('packages_counts', err);
      }
      out.push({
        id,
        name: String(row.name || ''),
        kind: String(row.kind || ''),
        status: String(row.status || 'draft'),
        driveFolderUrl: row.drive_folder_url ? String(row.drive_folder_url) : '',
        docCount,
        recipientCount,
      });
    }
    return out;
  } catch (err) {
    fail('packages_list', err);
    return [];
  }
}

async function seedPackages(sql: Sql, ownerId: string) {
  for (const item of STARTERS) {
    try {
      await sql`
        INSERT INTO packages (owner_id, name, kind, email_subject, email_body, research, status)
        VALUES (${ownerId}, ${item.name}, ${item.kind}, ${item.emailSubject}, ${item.emailBody}, ${item.research}, 'draft')
      `;
    } catch (err) {
      fail('packages_seed', err);
    }
  }
}

async function owned(sql: Sql, ownerId: string, id: string) {
  const rows = await sql`
    SELECT id, name, kind, drive_folder_id, drive_folder_url, email_subject, email_body, research, status
    FROM packages
    WHERE id = ${id} AND owner_id = ${ownerId}
  `;
  return (rows[0] as Record<string, unknown> | undefined) || null;
}

export async function readPackage(sql: Sql, ownerId: string, id: string) {
  try {
    const row = await owned(sql, ownerId, id);
    if (!row) return null;
    const docs = await readDocs(sql, id);
    const recipients = await readRecipients(sql, ownerId, id);
    const shaped = shapePackage(row, docs, recipients);
    let folderFiles: Array<{ id: string; name: string; url: string; mime: string }> | null = null;
    if (shaped.driveFolderId) {
      try {
        folderFiles = await listFolderFiles(shaped.driveFolderId);
      } catch (err) {
        fail('packages_folder', err);
        folderFiles = null;
      }
    }
    return { ...shaped, folderFiles };
  } catch (err) {
    fail('packages_read', err);
    return null;
  }
}

export async function createPackage(sql: Sql, ownerId: string, name: string, kind: string) {
  const allowed = allowPackageKind(kind);
  const clean = clip(name, 120);
  if (!allowed || !clean) return null;
  const rows = await sql`
    INSERT INTO packages (owner_id, name, kind, status)
    VALUES (${ownerId}, ${clean}, ${allowed}, 'draft')
    RETURNING id
  `;
  return readPackage(sql, ownerId, String(rows[0]?.id || ''));
}

export async function patchPackage(sql: Sql, ownerId: string, id: string, body: Record<string, unknown>) {
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  const name = Object.prototype.hasOwnProperty.call(body, 'name') ? clip(body.name, 120) : null;
  const kind = Object.prototype.hasOwnProperty.call(body, 'kind') ? allowPackageKind(String(body.kind || '')) : null;
  const status = Object.prototype.hasOwnProperty.call(body, 'status') ? allowPackageStatus(String(body.status || '')) : null;
  if (Object.prototype.hasOwnProperty.call(body, 'name') && !name) return null;
  if (Object.prototype.hasOwnProperty.call(body, 'kind') && !kind) return null;
  if (Object.prototype.hasOwnProperty.call(body, 'status') && !status) return null;
  const subject = Object.prototype.hasOwnProperty.call(body, 'emailSubject') ? clip(body.emailSubject, 200) : null;
  const emailBody = Object.prototype.hasOwnProperty.call(body, 'emailBody') ? clip(body.emailBody, 8000) : null;
  const research = Object.prototype.hasOwnProperty.call(body, 'research') ? clip(body.research, 8000) : null;
  const setSubject = Object.prototype.hasOwnProperty.call(body, 'emailSubject');
  const setBody = Object.prototype.hasOwnProperty.call(body, 'emailBody');
  const setResearch = Object.prototype.hasOwnProperty.call(body, 'research');
  await sql`
    UPDATE packages SET
      name = CASE WHEN ${name !== null} THEN ${name} ELSE name END,
      kind = CASE WHEN ${kind !== null} THEN ${kind} ELSE kind END,
      status = CASE WHEN ${status !== null} THEN ${status} ELSE status END,
      email_subject = CASE WHEN ${setSubject} THEN ${subject} ELSE email_subject END,
      email_body = CASE WHEN ${setBody} THEN ${emailBody} ELSE email_body END,
      research = CASE WHEN ${setResearch} THEN ${research} ELSE research END,
      updated_at = now()
    WHERE id = ${id} AND owner_id = ${ownerId}
  `;
  return readPackage(sql, ownerId, id);
}

export async function bindFolder(sql: Sql, ownerId: string, id: string, folderId: string, folderUrl: string) {
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  const cleanId = clip(folderId, 120);
  if (!/^[\w-]{8,}$/.test(cleanId)) return null;
  const url = clip(folderUrl, 500) || `https://drive.google.com/drive/folders/${cleanId}`;
  await sql`
    UPDATE packages
    SET drive_folder_id = ${cleanId}, drive_folder_url = ${url}, updated_at = now()
    WHERE id = ${id} AND owner_id = ${ownerId}
  `;
  return readPackage(sql, ownerId, id);
}

export async function createFolder(sql: Sql, ownerId: string, id: string, name: string, parentId: string) {
  const made = (await driveWrite('mkdir', { name: clip(name, 180), parentId })) as { id?: string; name?: string; webViewLink?: string } | null;
  if (!made?.id) return null;
  return bindFolder(sql, ownerId, id, String(made.id), String(made.webViewLink || ''));
}

export async function addDoc(sql: Sql, ownerId: string, id: string, input: { driveFileId?: string; name?: string; url?: string; mime?: string }) {
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  const name = clip(input.name, 180);
  if (!name) return null;
  const fileId = clip(input.driveFileId, 120);
  const url = clip(input.url, 500);
  const mime = clip(input.mime, 120);
  if (fileId) {
    const existing = await sql`
      SELECT id FROM package_docs WHERE package_id = ${id} AND drive_file_id = ${fileId} LIMIT 1
    `;
    if (existing.length) return readPackage(sql, ownerId, id);
  }
  await sql`
    INSERT INTO package_docs (package_id, drive_file_id, name, url, mime)
    VALUES (${id}, ${fileId}, ${name}, ${url}, ${mime})
  `;
  await sql`UPDATE packages SET updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
  return readPackage(sql, ownerId, id);
}

export async function removeDoc(sql: Sql, ownerId: string, id: string, docId: string) {
  if (!packageIdOk(docId)) return null;
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  await sql`DELETE FROM package_docs WHERE id = ${docId} AND package_id = ${id}`;
  return readPackage(sql, ownerId, id);
}

export async function addRecipient(sql: Sql, ownerId: string, id: string, input: { contactId?: string; name?: string; email?: string; role?: string }) {
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  let name = clip(input.name, 120);
  let email = clip(input.email, 180);
  let role = clip(input.role, 120);
  const contactId = clip(input.contactId, 40);
  if (contactId && packageIdOk(contactId)) {
    const contacts = await sql`
      SELECT name, email, role FROM contacts WHERE id = ${contactId} AND owner_id = ${ownerId}
    `;
    const contact = contacts[0] as Record<string, unknown> | undefined;
    if (!contact) return null;
    name = String(contact.name || name);
    email = String(contact.email || '');
    role = String(contact.role || role);
  }
  if (!name) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';
  await sql`
    INSERT INTO package_recipients (package_id, contact_id, name, email, role)
    VALUES (${id}, ${contactId || null}, ${name}, ${email}, ${role})
  `;
  await sql`UPDATE packages SET updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
  return readPackage(sql, ownerId, id);
}

export async function removeRecipient(sql: Sql, ownerId: string, id: string, recipientId: string) {
  if (!packageIdOk(recipientId)) return null;
  const row = await owned(sql, ownerId, id);
  if (!row) return null;
  await sql`DELETE FROM package_recipients WHERE id = ${recipientId} AND package_id = ${id}`;
  return readPackage(sql, ownerId, id);
}

export async function prepareSend(sql: Sql, ownerId: string, id: string) {
  const current = await readPackage(sql, ownerId, id);
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
    if (draftId) drafts.push({ name: person.name, email: person.email, draftId });
    else {
      failed = true;
      manual.push({ name: person.name, email: person.email, subject, body, stage: person.stage });
    }
  }
  let status = current.status;
  if (drafts.length && !failed && current.recipients.every((person) => person.email)) {
    await sql`UPDATE packages SET status = 'sent', updated_at = now() WHERE id = ${id} AND owner_id = ${ownerId}`;
    status = 'sent';
  }
  const missing = current.recipients.some((person) => !person.email);
  const note = !drafts.length && missing && !failed
    ? 'No email on file. Copy the note below, or add the address from Contacts.'
    : !drafts.length
      ? 'Gmail could not open a draft. Reconnect Google if drafts should be created, or copy the note below.'
      : failed || missing
        ? 'Drafts were opened where an email was on file. Copy the note for anyone still waiting.'
        : 'Gmail drafts are ready for review. Nothing was sent.';
  return { prepared: true, note, status, drafts, manual, package: { ...current, status } };
}
