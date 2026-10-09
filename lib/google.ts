type Token = { access: string; exp: number };
let token: Token | null = null;

function configured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

export function googleConfigured() {
  return configured();
}

async function accessToken() {
  if (!configured()) return null;
  if (token && token.exp > Date.now() + 30_000) return token.access;
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
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
  token = { access: json.access_token, exp: Date.now() + (json.expires_in || 3000) * 1000 };
  return token.access;
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

export async function listEvents(timeMin: string, timeMax: string) {
  if (!configured()) return { status: 'unavailable' as const, events: [] };
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'chad@4ormfinance.com');
  const q = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '80',
  });
  const json = (await gfetch(
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?${q}`,
  )) as { items?: Array<Record<string, unknown>> } | null;
  if (!json) return { status: 'unavailable' as const, events: [] };
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
  return { status: events.length ? ('connected' as const) : ('reached_empty' as const), events };
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

type DriveNode = {
  id: string;
  name: string;
  url: string;
  children: DriveNode[];
  files: { id: string; name: string; url: string; kind: string }[];
};

type FileRow = { id: string; name: string; mimeType: string; webViewLink?: string };

function safeId(id: string) {
  return /^[\w-]{8,}$/.test(id);
}

async function listChildren(parentId: string, driveId: string) {
  if (!safeId(parentId) || !safeId(driveId)) return null;
  const q = new URLSearchParams({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink)',
    pageSize: '40',
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
    }));
}

const DRIVE_LIMIT = { drives: 4, folders: 6, deepFiles: 10 };

/** drives.list + each drive + each top folder + ten deepest file listings. 39 calls, under the 40 ceiling. */
export const DRIVE_CALLS = 1 + DRIVE_LIMIT.drives * (1 + DRIVE_LIMIT.folders) + DRIVE_LIMIT.deepFiles;

/** Shared drive, folder, subfolder. Files at each level come from that level's listing. */
export async function listDriveTree() {
  if (!configured()) return { status: 'unavailable' as const, drives: [] as Array<{ id: string; name: string; folders: DriveNode[] }> };
  const listed = (await gfetch('https://www.googleapis.com/drive/v3/drives?pageSize=10')) as {
    drives?: Array<{ id: string; name: string }>;
  } | null;
  if (!listed) return { status: 'unavailable' as const, drives: [] };
  let deepLeft = DRIVE_LIMIT.deepFiles;
  const out = [];
  for (const drive of (listed.drives || []).slice(0, DRIVE_LIMIT.drives)) {
    if (!safeId(drive.id)) continue;
    const top = await listChildren(drive.id, drive.id);
    if (!top) return { status: 'unavailable' as const, drives: out };
    const folders: DriveNode[] = [];
    for (const folder of top.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').slice(0, DRIVE_LIMIT.folders)) {
      const inner = await listChildren(folder.id, drive.id);
      if (!inner) continue;
      folders.push({
        id: folder.id,
        name: folder.name,
        url: folder.webViewLink || '',
        files: asFiles(inner),
        children: [],
      });
      const node = folders[folders.length - 1];
      for (const child of inner.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').slice(0, 8)) {
        const leaf = {
          id: child.id,
          name: child.name,
          url: child.webViewLink || '',
          children: [] as DriveNode[],
          files: [] as DriveNode['files'],
        };
        if (deepLeft > 0) {
          deepLeft -= 1;
          const deep = await listChildren(child.id, drive.id);
          if (deep) leaf.files = asFiles(deep);
        }
        node.children.push(leaf);
      }
    }
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

export async function recentMail() {
  if (!configured()) return { status: 'unavailable' as const, messages: [] as Array<{ id: string; title: string }> };
  const listed = (await gfetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=' + encodeURIComponent('newer_than:1d'),
  )) as { messages?: Array<{ id: string }> } | null;
  if (!listed) return { status: 'unavailable' as const, messages: [] };
  const ids = listed.messages || [];
  const messages = [];
  for (const row of ids.slice(0, 8)) {
    const msg = (await gfetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.id)}?format=metadata&metadataHeaders=Subject`,
    )) as { id?: string; payload?: { headers?: Array<{ name: string; value: string }> } } | null;
    const subject = msg?.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value || '';
    if (msg?.id && subject) messages.push({ id: msg.id, title: subject.slice(0, 180) });
  }
  return { status: messages.length ? ('connected' as const) : ('reached_empty' as const), messages };
}
