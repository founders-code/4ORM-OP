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
  if (!safeId(parentId) || !safeId(driveId)) return null;
  const q = new URLSearchParams({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,owners(displayName,me))',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'drive',
    driveId,
  });
  const json = (await gfetch(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: FileRow[] } | null;
  return json?.files || null;
}

function asFiles(rows: FileRow[]) {
  return rows
    .filter((f) => f.mimeType !== 'application/vnd.google-apps.folder')
    .slice(0, 40)
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

const DRIVE_LIMIT = { drives: 38 };

/** drives.list plus one files.list per shared drive. 39 calls, under the 40 ceiling. Deeper folders load on open. */
export const DRIVE_CALLS = 1 + DRIVE_LIMIT.drives;

/** Every shared drive, with every top-level folder from that drive's listing. */
export async function listDriveTree() {
  if (!configured()) return { status: 'unavailable' as const, drives: [] as Array<{ id: string; name: string; folders: DriveNode[] }> };
  const listed = (await gfetch('https://www.googleapis.com/drive/v3/drives?pageSize=100')) as {
    drives?: Array<{ id: string; name: string }>;
  } | null;
  if (!listed) return { status: 'unavailable' as const, drives: [] };
  const out = [];
  for (const drive of (listed.drives || []).slice(0, DRIVE_LIMIT.drives)) {
    if (!safeId(drive.id)) continue;
    const top = await listChildren(drive.id, drive.id);
    if (!top) continue;
    const folders: DriveNode[] = top
      .filter((row) => row.mimeType === 'application/vnd.google-apps.folder')
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        url: folder.webViewLink || '',
        files: [],
        children: [],
      }));
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
    pageSize: '40',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const json = (await gfetch(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: FileRow[] } | null;
  if (!json?.files) return null;
  return json.files
    .filter((file) => file.mimeType !== 'application/vnd.google-apps.folder' && file.id && file.name)
    .slice(0, 40)
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
    pageSize: '40',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const json = (await gfetch(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: FileRow[] } | null;
  if (!json?.files) return null;
  const rows = json.files;
  return {
    folders: rows
      .filter((file) => file.mimeType === 'application/vnd.google-apps.folder' && file.id && file.name)
      .slice(0, 40)
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

export async function inboxMail() {
  if (!configured()) return { status: 'unavailable' as const, messages: [] as Array<{ from: string; email: string; subject: string; snippet: string; at: number }> };
  const listed = (await gfetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=' + encodeURIComponent('newer_than:14d'),
  )) as { messages?: Array<{ id: string }> } | null;
  if (!listed) return { status: 'unavailable' as const, messages: [] };
  const messages = [];
  for (const row of (listed.messages || []).slice(0, 8)) {
    const msg = (await gfetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    )) as { snippet?: string; internalDate?: string; payload?: { headers?: Array<{ name: string; value: string }> } } | null;
    const headers = msg?.payload?.headers || [];
    const pick = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value || '';
    const rawFrom = pick('from');
    const email = ((rawFrom.match(/<([^>]+)>/) || [])[1] || (rawFrom.includes('@') ? rawFrom : '')).trim().slice(0, 120);
    const from = rawFrom.replace(/<[^>]+>/g, '').replace(/"/g, '').trim().slice(0, 80);
    const subject = pick('subject').slice(0, 180);
    if (!from && !subject) continue;
    messages.push({
      from: from || 'Sender',
      email,
      subject: subject || '(no subject)',
      snippet: String(msg?.snippet || '').slice(0, 160),
      at: Number(msg?.internalDate) || Date.parse(pick('date')) || Date.now(),
    });
  }
  return { status: messages.length ? ('connected' as const) : ('reached_empty' as const), messages };
}
