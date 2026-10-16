import { createHash } from 'crypto';
import { currentCreds } from './creds';
import { env } from './env.mjs';

type Token = { access: string; exp: number };
const tokens = new Map<string, Token>();

function refreshToken() {
  return currentCreds().googleRefresh || process.env.GOOGLE_REFRESH_TOKEN || '';
}

function configured() {
  return !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && refreshToken());
}

export function googleConfigured() {
  return configured();
}

async function accessToken() {
  const refresh = refreshToken();
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret || !refresh) return null;
  const key = createHash('sha256').update(refresh).digest('hex');
  const cached = tokens.get(key);
  if (cached && cached.exp > Date.now() + 30_000) return cached.access;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  const next = { access: json.access_token, exp: Date.now() + (json.expires_in || 3000) * 1000 };
  tokens.set(key, next);
  return next.access;
}

async function gfetch(url: string, init?: RequestInit) {
  const access = await accessToken();
  if (!access) return null;
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json', ...(init?.headers || {}) },
    signal: init?.signal || AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function pullCalendar(calendarId: string, timeMin: string, timeMax: string, pageToken: string) {
  const q = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  if (pageToken) q.set('pageToken', pageToken);
  return (await gfetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
  )) as { items?: Array<Record<string, unknown>>; nextPageToken?: string } | null;
}

export async function listEvents(timeMin: string, timeMax: string, pageToken = '') {
  if (!configured()) return { status: 'unavailable' as const, events: [], nextPageToken: '' };
  const named = process.env.GOOGLE_CALENDAR_ID || 'primary';
  let json = await pullCalendar(named, timeMin, timeMax, pageToken);
  if (( !json || !(json.items || []).length) && named !== 'primary') {
    const alt = await pullCalendar('primary', timeMin, timeMax, pageToken);
    if (alt && ((alt.items || []).length || !json)) json = alt;
  }
  if (!json) return { status: 'unavailable' as const, events: [], nextPageToken: '' };
  const items = json.items || [];
  const events = items
    .map((ev) => {
      const start = (ev.start as { dateTime?: string; date?: string } | undefined) || {};
      const end = (ev.end as { dateTime?: string; date?: string } | undefined) || {};
      const startMs = start.dateTime ? Date.parse(start.dateTime) : start.date ? Date.parse(start.date) : NaN;
      const endMs = end.dateTime ? Date.parse(end.dateTime) : end.date ? Date.parse(end.date) : startMs + 30 * 60 * 1000;
      if (!ev.id || Number.isNaN(startMs)) return null;
      return {
        id: String(ev.id),
        start: startMs,
        dur: Math.max(15, Math.round((endMs - startMs) / 60000)),
        title: String(ev.summary || 'Busy'),
        color: '#2E6BF2',
      };
    })
    .filter(Boolean);
  return {
    status: events.length ? ('connected' as const) : ('reached_empty' as const),
    events,
    nextPageToken: String(json.nextPageToken || ''),
  };
}

async function postEvent(calendarId: string, startMs: number, durMin: number, title: string) {
  const start = new Date(startMs);
  const end = new Date(startMs + durMin * 60 * 1000);
  const json = (await gfetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify({
      summary: String(title || 'Focus').slice(0, 180),
      start: { dateTime: start.toISOString(), timeZone: 'America/Los_Angeles' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Los_Angeles' },
    }),
  })) as { id?: string } | null;
  return json?.id ? String(json.id) : null;
}

export async function createEvent(startMs: number, durMin: number, title: string) {
  if (!configured()) return null;
  const named = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const id = await postEvent(named, startMs, durMin, title);
  if (id || named === 'primary') return id;
  return postEvent('primary', startMs, durMin, title);
}

const OFFICE_AS_GOOGLE: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.google-apps.document',
  'application/msword': 'application/vnd.google-apps.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
};

async function pdfBytes(access: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fpdf`, {
    headers: { authorization: `Bearer ${access}` },
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function exportDriveFile(fileId: string) {
  if (!configured() || !/^[\w-]{8,}$/.test(fileId)) return null;
  const access = await accessToken();
  if (!access) return null;
  const meta = (await gfetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`,
  )) as { name?: string; mimeType?: string } | null;
  if (!meta) return null;
  const name = String(meta.name || 'Document');
  const googleType = String(meta.mimeType || '');
  const native = googleType.startsWith('application/vnd.google-apps.') && googleType !== 'application/vnd.google-apps.folder';
  if (native) {
    const bytes = await pdfBytes(access, fileId);
    return bytes ? { name, type: 'application/pdf', bytes } : null;
  }
  const office = OFFICE_AS_GOOGLE[googleType];
  if (office) {
    const copied = (await gfetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/copy?supportsAllDrives=true&fields=id`,
      { method: 'POST', body: JSON.stringify({ name: '4orm preview', mimeType: office }) },
    )) as { id?: string } | null;
    const copyId = String(copied?.id || '');
    if (!/^[\w-]{8,}$/.test(copyId)) return null;
    try {
      const bytes = await pdfBytes(access, copyId);
      return bytes ? { name, type: 'application/pdf', bytes } : null;
    } finally {
      await fetch(`https://www.googleapis.com/drive/v3/files/${copyId}?supportsAllDrives=true`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${access}` },
      }).catch(() => null);
    }
  }
  const direct = googleType.startsWith('image/') || googleType === 'application/pdf' || googleType.startsWith('text/');
  if (!direct) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${access}` },
  });
  if (!res.ok) return null;
  return { name, type: googleType, bytes: Buffer.from(await res.arrayBuffer()) };
}

export async function moveEvent(id: string, startMs: number, durMin: number) {
  if (!configured()) return false;
  if (!/^[\w-]+$/.test(id)) return false;
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'chad@4ormfinance.com');
  const start = new Date(startMs);
  const end = new Date(startMs + durMin * 60 * 1000);
  const json = await gfetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      start: { dateTime: start.toISOString(), timeZone: 'America/Edmonton' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Edmonton' },
    }),
  });
  return !!json;
}

type DriveFile = { id: string; name: string; url: string; kind: string; mime: string; thumb: string; modified?: string; owner?: string };

type DriveNode = {
  id: string;
  name: string;
  url: string;
  children: DriveNode[];
  files: DriveFile[];
};

type FileRow = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  owners?: Array<{ displayName?: string; me?: boolean }>;
};

function ownerOf(row: FileRow) {
  const first = row.owners?.[0];
  if (!first) return 'Shared';
  return first.me ? 'You' : (first.displayName || 'Shared').slice(0, 60);
}

function safeId(id: string) {
  return /^[\w-]{8,}$/.test(id);
}

async function listChildren(parentId: string, driveId: string) {
  if (!safeId(parentId) || (driveId && !safeId(driveId))) return null;
  const q = new URLSearchParams({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,owners(displayName,me))',
    pageSize: '200',
    orderBy: 'folder,name',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    ...(driveId ? { corpora: 'drive', driveId } : { corpora: 'user' }),
  });
  const json = (await gfetch(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: FileRow[] } | null;
  return json?.files || null;
}

function asFiles(rows: FileRow[]) {
  return rows
    .filter((f) => f.mimeType !== 'application/vnd.google-apps.folder')
    .slice(0, 200)
    .map((f) => ({
      id: f.id,
      name: f.name,
      url: f.webViewLink || '',
      kind: (f.name.split('.').pop() || 'file').slice(0, 8),
      mime: f.mimeType || '',
      thumb: f.thumbnailLink || '',
      modified: f.modifiedTime || '',
      owner: ownerOf(f),
    }));
}

const DRIVE_LIMIT = { drives: 34 };

/** Up to two drives.list pages, My Drive (root lookup plus listing), Shared with me, and one files.list per shared drive. 39 calls, under the 40 ceiling. Deeper folders load on open. */
export const DRIVE_CALLS = 5 + DRIVE_LIMIT.drives;

function asFolders(rows: FileRow[]): DriveNode[] {
  return rows
    .filter((row) => row.mimeType === 'application/vnd.google-apps.folder')
    .map((folder) => ({ id: folder.id, name: folder.name, url: folder.webViewLink || '', files: [], children: [] }));
}

/** Every shared drive, with every top-level folder from that drive's listing. */
export async function listDriveTree() {
  if (!configured()) return { status: 'unavailable' as const, drives: [] as Array<{ id: string; name: string; folders: DriveNode[] }> };
  type Listed = { drives?: Array<{ id: string; name: string }>; nextPageToken?: string } | null;
  const listed = (await gfetch('https://www.googleapis.com/drive/v3/drives?pageSize=100')) as Listed;
  const out: Array<{ id: string; name: string; folders: DriveNode[]; files: DriveFile[] }> = [];
  const root = (await gfetch('https://www.googleapis.com/drive/v3/files/root?fields=id')) as { id?: string } | null;
  if (root?.id && safeId(root.id)) {
    const mine = await listChildren(root.id, '');
    if (mine) out.push({ id: root.id, name: 'My Drive', folders: asFolders(mine), files: asFiles(mine) });
  }
  const sharedQ = new URLSearchParams({
    q: 'sharedWithMe = true and trashed = false',
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,owners(displayName,me))',
    pageSize: '200',
    orderBy: 'folder,name',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'user',
  });
  const shared = (await gfetch(`https://www.googleapis.com/drive/v3/files?${sharedQ}`)) as { files?: FileRow[] } | null;
  if (shared?.files?.length) {
    out.push({ id: 'shared-with-me', name: 'Shared with me', folders: asFolders(shared.files), files: asFiles(shared.files) });
  }
  if (!listed && !out.length) return { status: 'unavailable' as const, drives: [] };
  const all = [...(listed?.drives || [])];
  if (listed?.nextPageToken) {
    const more = (await gfetch(`https://www.googleapis.com/drive/v3/drives?pageSize=100&pageToken=${encodeURIComponent(listed.nextPageToken)}`)) as Listed;
    all.push(...(more?.drives || []));
  }
  for (const drive of all.slice(0, DRIVE_LIMIT.drives)) {
    if (!safeId(drive.id)) continue;
    const top = await listChildren(drive.id, drive.id);
    if (!top) continue;
    const folders = asFolders(top);
    out.push({
      id: drive.id,
      name: drive.name,
      folders,
      files: asFiles(top),
    });
  }
  return { status: out.length ? ('connected' as const) : ('reached_empty' as const), drives: out };
}

export async function driveWrite(action: 'mkdir' | 'mkfile' | 'rename' | 'move', input: { name?: string; parentId?: string; id?: string }) {
  if (!configured()) return null;
  if (action === 'mkfile') {
    const name = (input.name || '').trim().slice(0, 180);
    const parentId = input.parentId || '';
    if (!name || !safeId(parentId)) return null;
    return gfetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.document',
        parents: [parentId],
      }),
    });
  }
  if (action === 'mkdir') {
    const name = (input.name || '').trim().slice(0, 180);
    const parentId = input.parentId || '';
    if (!name || !/^[\w-]{8,}$/.test(parentId)) return null;
    return gfetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
  }
  if (!input.id || !/^[\w-]{8,}$/.test(input.id)) return null;
  if (action === 'rename') {
    const name = (input.name || '').trim().slice(0, 180);
    if (!name) return null;
    return gfetch(`https://www.googleapis.com/drive/v3/files/${input.id}?supportsAllDrives=true`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }
  if (!input.parentId || !/^[\w-]{8,}$/.test(input.parentId)) return null;
  const meta = (await gfetch(
    `https://www.googleapis.com/drive/v3/files/${input.id}?fields=parents&supportsAllDrives=true`,
  )) as { parents?: string[] } | null;
  const previous = (meta?.parents || []).join(',');
  return gfetch(
    `https://www.googleapis.com/drive/v3/files/${input.id}?addParents=${input.parentId}&removeParents=${encodeURIComponent(previous)}&supportsAllDrives=true`,
    { method: 'PATCH', body: '{}' },
  );
}

export async function listFolderFiles(folderId: string) {
  if (!configured() || !safeId(folderId)) return null;
  const q = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,owners(displayName,me))',
    pageSize: '200',
    orderBy: 'folder,name',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  });
  const json = (await gfetch(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: FileRow[] } | null;
  if (!json?.files) return null;
  return json.files
    .filter((file) => file.mimeType !== 'application/vnd.google-apps.folder' && file.id && file.name)
    .slice(0, 200)
    .map((file) => ({
      id: file.id,
      name: file.name,
      url: file.webViewLink || '',
      mime: file.mimeType || '',
      thumb: file.thumbnailLink || '',
      modified: file.modifiedTime || '',
      owner: ownerOf(file),
    }));
}

/** One folder, files and subfolders. One Drive call. */
export async function listFolderContents(folderId: string) {
  if (!configured() || !safeId(folderId)) return null;
  const q = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,owners(displayName,me))',
    pageSize: '200',
    orderBy: 'folder,name',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  });
  const json = (await gfetch(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: FileRow[] } | null;
  if (!json?.files) return null;
  const rows = json.files;
  return {
    folders: rows
      .filter((file) => file.mimeType === 'application/vnd.google-apps.folder' && file.id && file.name)
      .slice(0, 200)
      .map((file) => ({
        id: file.id,
        name: file.name,
        url: file.webViewLink || '',
        children: [] as DriveNode[],
        files: [] as DriveFile[],
      })),
    files: asFiles(rows),
  };
}

export async function copyDriveFile(fileId: string, parentId: string, name: string) {
  if (!configured() || !safeId(fileId) || !safeId(parentId)) return null;
  const clean = name.trim().slice(0, 180);
  if (!clean) return null;
  return gfetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy?supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'POST',
    body: JSON.stringify({ name: clean, parents: [parentId] }),
  });
}

export async function uploadDriveBytes(name: string, mime: string, parentId: string, bytes: Buffer) {
  if (!configured() || !safeId(parentId) || !bytes.length) return null;
  const clean = name.trim().slice(0, 180);
  if (!clean) return null;
  const access = await accessToken();
  if (!access) return null;
  const boundary = `4orm${Date.now()}`;
  const meta = JSON.stringify({ name: clean, parents: [parentId] });
  const type = mime || 'application/octet-stream';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${access}`, 'content-type': `multipart/related; boundary=${boundary}` },
      body: Buffer.concat([head, bytes, tail]),
    },
  );
  if (!res.ok) return null;
  return res.json() as Promise<{ id?: string; name?: string; webViewLink?: string }>;
}

export async function createGmailDraft(to: string, subject: string, text: string) {
  if (!configured()) return null;
  const cleanTo = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) return null;
  const cleanSubject = String(subject || '').replace(/[\r\n]/g, ' ').slice(0, 200);
  const mime = [
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    String(text || ''),
  ].join('\r\n');
  const raw = Buffer.from(mime).toString('base64url');
  try {
    const json = (await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      body: JSON.stringify({ message: { raw } }),
    })) as { id?: string } | null;
    return json?.id ? String(json.id) : null;
  } catch {
    return null;
  }
}

export async function recentMail() {
  if (!configured()) return { status: 'unavailable' as const, messages: [] as Array<{ id: string; title: string; from: string; at: number }> };
  const listed = (await gfetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=' + encodeURIComponent('newer_than:1d'),
  )) as { messages?: Array<{ id: string }> } | null;
  if (!listed) return { status: 'unavailable' as const, messages: [] };
  const ids = listed.messages || [];
  const messages = [];
  for (const row of ids.slice(0, 8)) {
    const msg = (await gfetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    )) as { id?: string; internalDate?: string; payload?: { headers?: Array<{ name: string; value: string }> } } | null;
    const headers = msg?.payload?.headers || [];
    const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value || '';
    const subject = header('subject');
    const from = header('from').slice(0, 180);
    const at = Number(msg?.internalDate) || Date.parse(header('date')) || 0;
    if (msg?.id && subject) messages.push({ id: msg.id, title: subject.slice(0, 180), from, at });
  }
  return { status: messages.length ? ('connected' as const) : ('reached_empty' as const), messages };
}

type GmailMeta = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: Array<{ name: string; value: string }> };
};

export type InboxRow = {
  id: string;
  threadId: string;
  messageId: string;
  from: string;
  email: string;
  subject: string;
  snippet: string;
  at: number;
  unread: boolean;
  outbound: boolean;
  internal: boolean;
};

export type LinkedinRow = { id: string; name: string; kind: 'message' | 'invite' | 'inmail' | 'update'; snippet: string; at: number; unread: boolean };

const LINKEDIN_ALIAS = 'chadsapps@4ormfinance.com';
const LINKEDIN_SENDERS = ['messaging-digest@linkedin.com', 'invitations@linkedin.com', 'inmail-hit-reply@linkedin.com', 'messages-noreply@bounce.linkedin.com'];

function addressOf(raw: string) {
  const inside = (raw.match(/<([^>]+)>/) || [])[1];
  const bare = inside || (raw.includes('@') ? raw : '');
  return bare.replace(/["']/g, '').trim().toLowerCase().slice(0, 120);
}

function displayOf(raw: string) {
  return raw.replace(/<[^>]+>/g, '').replace(/"/g, '').trim().slice(0, 80);
}

function splitAddresses(raw: string) {
  return String(raw || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((part) => part.trim()).filter(Boolean);
}

function decodeSnippet(value: string) {
  return String(value || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

async function mailboxSelf() {
  const addresses = new Set<string>();
  const names = new Set<string>();
  const profile = (await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/profile')) as { emailAddress?: string } | null;
  const primary = String(profile?.emailAddress || '').toLowerCase();
  if (primary) addresses.add(primary);
  const sendAs = (await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs')) as {
    sendAs?: Array<{ sendAsEmail?: string; displayName?: string }>;
  } | null;
  for (const row of sendAs?.sendAs || []) {
    if (row.sendAsEmail) addresses.add(String(row.sendAsEmail).toLowerCase());
    if (row.displayName) names.add(String(row.displayName).trim().toLowerCase());
  }
  addresses.add(LINKEDIN_ALIAS);
  const domain = primary.split('@')[1] || '';
  return { addresses, names, domain };
}

async function gmailList(q: string, max: number) {
  const listed = (await gfetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`,
  )) as { messages?: Array<{ id: string }> } | null;
  if (!listed) return null;
  const headers = ['From', 'To', 'Subject', 'Date', 'Message-ID', 'Delivered-To'].map((h) => `metadataHeaders=${h}`).join('&');
  const ids = (listed.messages || []).slice(0, max);
  const rows = await Promise.all(ids.map((row) =>
    (gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.id)}?format=metadata&${headers}`) as Promise<GmailMeta | null>)
      .catch(() => null),
  ));
  return rows.filter((row): row is GmailMeta => !!row && !!row.id);
}

function headerOf(msg: GmailMeta) {
  const headers = msg.payload?.headers || [];
  return (name: string) => headers.filter((h) => h.name.toLowerCase() === name).map((h) => h.value).join(', ');
}

export async function inboxMail() {
  if (!configured()) return { status: 'unavailable' as const, messages: [] as InboxRow[] };
  if (!(await accessToken())) return { status: 'unavailable' as const, messages: [] as InboxRow[] };
  const self = await mailboxSelf().catch(() => ({ addresses: new Set<string>(), names: new Set<string>(), domain: '' }));
  const rows = await gmailList('newer_than:14d in:inbox -category:promotions -category:social -from:linkedin.com', 20);
  if (!rows) return { status: 'unavailable' as const, messages: [] as InboxRow[] };
  const isSelf = (raw: string) => {
    const address = addressOf(raw);
    const name = displayOf(raw).toLowerCase();
    return (!!address && self.addresses.has(address)) || (!!name && self.names.has(name));
  };
  const sent = (await gmailList('in:sent', 2).catch(() => null)) || [];
  for (const msg of sent) {
    const rawFrom = headerOf(msg)('from');
    if (addressOf(rawFrom)) self.addresses.add(addressOf(rawFrom));
    if (displayOf(rawFrom)) self.names.add(displayOf(rawFrom).toLowerCase());
  }
  for (const msg of rows) {
    const rawFrom = headerOf(msg)('from');
    const name = displayOf(rawFrom).toLowerCase();
    if (name && self.addresses.has(addressOf(rawFrom))) self.names.add(name);
  }
  const messages: InboxRow[] = [];
  for (const msg of rows) {
    const pick = headerOf(msg);
    const rawFrom = pick('from');
    const delivered = pick('delivered-to').toLowerCase();
    if (delivered.includes(LINKEDIN_ALIAS) || /linkedin\.com/i.test(addressOf(rawFrom))) continue;
    let party = rawFrom;
    let outbound = false;
    if (isSelf(rawFrom)) {
      const other = splitAddresses(pick('to')).find((raw) => !isSelf(raw));
      if (!other) continue;
      party = other;
      outbound = true;
    }
    const email = addressOf(party);
    if (/^(no-?reply|do-?not-?reply|mailer-daemon|notifications?)@/.test(email)) continue;
    const from = displayOf(party) || email || 'Sender';
    const subject = pick('subject').slice(0, 180);
    if (!from && !subject) continue;
    messages.push({
      id: String(msg.id),
      threadId: String(msg.threadId || ''),
      messageId: pick('message-id').slice(0, 300),
      from: from.includes('@') ? from.split('@')[0] : from,
      email,
      subject: subject || '(no subject)',
      snippet: decodeSnippet(String(msg.snippet || '')),
      at: Number(msg.internalDate) || Date.parse(pick('date')) || Date.now(),
      unread: (msg.labelIds || []).includes('UNREAD'),
      outbound,
      internal: !!self.domain && email.endsWith('@' + self.domain),
    });
  }
  messages.sort((a, b) => b.at - a.at);
  const top = messages.slice(0, 8);
  return { status: top.length ? ('connected' as const) : ('reached_empty' as const), messages: top };
}

function linkedinName(subject: string, fromRaw: string) {
  const s = subject.replace(/\s+/g, ' ').trim();
  const patterns = [
    /^(.+?) (?:has )?(?:just )?sent you (?:a )?(?:new )?message/i,
    /^(.+?) (?:just )?messaged you/i,
    /^(.+?) (?:wants to connect|would like to connect|has invited you|invited you to connect)/i,
    /^(.+?) (?:accepted|has accepted) your invitation/i,
    /^(.+?) replied to your (?:inmail|message)/i,
    /^(?:re: )?(.+?) (?:is waiting for your response|is waiting for your reply)/i,
    /^(?:you have )?(?:a )?new messages? from (.+?)$/i,
    /^invitation (?:from|to connect with) (.+?)$/i,
    /^(?:inmail|new inmail) from (.+?)$/i,
    /^(.+?) (?:viewed your profile|mentioned you|commented on|reacted to|endorsed you)/i,
  ];
  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match && match[1]) {
      const name = match[1].replace(/^(?:fwd?|re):\s*/i, '').replace(/[,.:;!]+$/, '').trim();
      if (name && name.length <= 60 && !/^(you|your|linkedin)$/i.test(name)) return name;
    }
  }
  const display = displayOf(fromRaw).replace(/\s+via linkedin$/i, '').trim();
  if (display && !/^linkedin/i.test(display) && !display.includes('@')) return display.slice(0, 60);
  return '';
}

function linkedinKind(subject: string, address: string): LinkedinRow['kind'] {
  const blob = `${subject} ${address}`.toLowerCase();
  if (/inmail/.test(blob)) return 'inmail';
  if (/invitation|invite|connect/.test(blob)) return 'invite';
  if (/messag/.test(blob)) return 'message';
  return 'update';
}

export async function linkedinMail() {
  if (!configured()) return { status: 'unavailable' as const, items: [] as LinkedinRow[] };
  if (!(await accessToken())) return { status: 'unavailable' as const, items: [] as LinkedinRow[] };
  const senders = LINKEDIN_SENDERS.map((s) => `from:${s}`).join(' OR ');
  const rows = await gmailList(`newer_than:30d (${senders} OR from:linkedin.com OR to:${LINKEDIN_ALIAS} OR deliveredto:${LINKEDIN_ALIAS})`, 15);
  if (!rows) return { status: 'unavailable' as const, items: [] as LinkedinRow[] };
  const items: LinkedinRow[] = [];
  for (const msg of rows) {
    const pick = headerOf(msg);
    const fromRaw = pick('from');
    const address = addressOf(fromRaw);
    const toBlob = `${pick('to')} ${pick('delivered-to')}`.toLowerCase();
    const isLinkedin = address.endsWith('linkedin.com') || toBlob.includes(LINKEDIN_ALIAS);
    if (!isLinkedin) continue;
    const subject = pick('subject').slice(0, 180);
    items.push({
      id: String(msg.id),
      name: linkedinName(subject, fromRaw) || 'LinkedIn',
      kind: linkedinKind(subject, address),
      snippet: decodeSnippet(String(msg.snippet || subject)),
      at: Number(msg.internalDate) || Date.parse(pick('date')) || Date.now(),
      unread: (msg.labelIds || []).includes('UNREAD'),
    });
  }
  items.sort((a, b) => b.at - a.at);
  return { status: items.length ? ('connected' as const) : ('reached_empty' as const), items: items.slice(0, 12) };
}

export async function createReplyDraft(input: { to: string; subject: string; text: string; threadId?: string; messageId?: string }) {
  if (!configured()) return null;
  const cleanTo = String(input.to || '').trim();
  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(cleanTo)) return null;
  const base = String(input.subject || '').replace(/[\r\n]/g, ' ').slice(0, 200);
  const subject = /^re:/i.test(base) ? base : `Re: ${base}`;
  const ref = String(input.messageId || '').replace(/[\r\n]/g, '').slice(0, 300);
  const lines = [`To: ${cleanTo}`, `Subject: ${subject}`];
  if (/^<[^<>\s]+>$/.test(ref)) lines.push(`In-Reply-To: ${ref}`, `References: ${ref}`);
  lines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', String(input.text || '').slice(0, 20000));
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
  const threadId = /^[A-Za-z0-9]{6,40}$/.test(String(input.threadId || '')) ? String(input.threadId) : undefined;
  try {
    const json = (await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      body: JSON.stringify({ message: threadId ? { raw, threadId } : { raw } }),
    })) as { id?: string } | null;
    return json?.id ? String(json.id) : null;
  } catch {
    return null;
  }
}
