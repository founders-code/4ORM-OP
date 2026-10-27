/** Drive helpers for the Documents library: thumbnails, metadata, a name search for the picker,
 *  and a resumable upload relayed through our server in chunks (so files are not capped by the
 *  serverless request body limit). All calls run under the caller's withCreds(). */
import { googleAccessToken, googleConfigured } from './google';
import { outbound } from './outbound';

const DRIVE_ID = /^[\w-]{8,200}$/;
const UPLOAD_PREFIX = 'https://www.googleapis.com/upload/drive/v3/files';

export function driveIdOk(id: string) {
  return DRIVE_ID.test(String(id || ''));
}

async function token() {
  if (!googleConfigured()) return null;
  return googleAccessToken();
}

async function getJson(url: string, access: string) {
  const res = await outbound(url, { headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export type DriveMeta = {
  id: string;
  name: string;
  mime: string;
  modified: string;
  owner: string;
  size: number;
  url: string;
  thumb: boolean;
};

export async function driveFileMeta(fileId: string): Promise<DriveMeta | null> {
  if (!driveIdOk(fileId)) return null;
  const access = await token();
  if (!access) return null;
  const fields = 'id,name,mimeType,modifiedTime,owners(displayName,me),size,webViewLink,thumbnailLink';
  const json = (await getJson(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
    access,
  )) as Record<string, unknown> | null;
  if (!json?.id) return null;
  const owners = Array.isArray(json.owners) ? (json.owners as Array<{ displayName?: string; me?: boolean }>) : [];
  const owner = owners[0] ? (owners[0].me ? 'You' : String(owners[0].displayName || '')) : 'Shared drive';
  return {
    id: String(json.id),
    name: String(json.name || ''),
    mime: String(json.mimeType || ''),
    modified: String(json.modifiedTime || ''),
    owner,
    size: Number(json.size || 0),
    url: String(json.webViewLink || ''),
    thumb: !!json.thumbnailLink,
  };
}

/** First-page thumbnail bytes for a Drive file (Drive renders PDFs, Office and Google files). */
export async function driveThumbnail(fileId: string, size = 400) {
  if (!driveIdOk(fileId)) return null;
  const access = await token();
  if (!access) return null;
  const json = (await getJson(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink&supportsAllDrives=true`,
    access,
  )) as { thumbnailLink?: string } | null;
  let link = String(json?.thumbnailLink || '');
  if (!/^https:\/\/[\w.-]+\.(googleusercontent|google)\.com\//.test(link)) return null;
  link = link.replace(/=s\d+$/, `=s${Math.max(120, Math.min(800, size))}`);
  const res = await outbound(link, { headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const type = String(res.headers.get('content-type') || '');
  if (!/^image\/(png|jpe?g|gif|webp)/.test(type)) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > 3_000_000) return null;
  return { type, bytes };
}

/** Name search across My Drive and shared drives, newest first. Folders are left out. */
export async function driveSearch(query: string) {
  const access = await token();
  if (!access) return null;
  const clean = String(query || '').replace(/[\\']/g, ' ').trim().slice(0, 80);
  const parts = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'"];
  if (clean) parts.push(`name contains '${clean}'`);
  const q = new URLSearchParams({
    q: parts.join(' and '),
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
    pageSize: '30',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  });
  const json = (await getJson(`https://www.googleapis.com/drive/v3/files?${q}`, access)) as { files?: Array<Record<string, unknown>> } | null;
  if (!json) return null;
  return (json.files || [])
    .filter((f) => driveIdOk(String(f.id || '')))
    .map((f) => ({
      id: String(f.id),
      name: String(f.name || 'File'),
      mime: String(f.mimeType || ''),
      url: String(f.webViewLink || ''),
      modified: String(f.modifiedTime || ''),
    }));
}

/** Opens a resumable upload session in the given Drive folder. Returns the session URL. */
export async function startResumable(name: string, mime: string, size: number, parentId: string) {
  if (!driveIdOk(parentId) || !(size > 0)) return null;
  const access = await token();
  if (!access) return null;
  const res = await outbound(`${UPLOAD_PREFIX}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${access}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': mime || 'application/octet-stream',
      'x-upload-content-length': String(size),
    },
    body: JSON.stringify({ name: name.trim().slice(0, 180) || 'File', parents: [parentId] }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const loc = String(res.headers.get('location') || '');
  return loc.startsWith(UPLOAD_PREFIX) ? loc : null;
}

/** Sends one chunk. done:false carries the next offset Drive expects; done:true carries the file. */
export async function putChunk(sessionUrl: string, bytes: Buffer, offset: number, total: number) {
  if (!sessionUrl.startsWith(UPLOAD_PREFIX) || !bytes.length) return null;
  const access = await token();
  if (!access) return null;
  const end = offset + bytes.length - 1;
  const res = await outbound(sessionUrl, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${access}`,
      'content-length': String(bytes.length),
      'content-range': `bytes ${offset}-${end}/${total}`,
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(50000),
  });
  if (res.status === 308) {
    const range = String(res.headers.get('range') || '');
    const m = range.match(/bytes=0-(\d+)/);
    return { done: false as const, next: m ? Number(m[1]) + 1 : 0 };
  }
  if (res.status === 200 || res.status === 201) {
    const json = (await res.json().catch(() => null)) as { id?: string; webViewLink?: string } | null;
    if (!json?.id) return null;
    return { done: true as const, id: String(json.id), url: String(json.webViewLink || '') };
  }
  return null;
}

/** Page count of a stored PDF without a PDF library: counts page objects. Good enough for paging. */
export function pdfPageCount(bytes: Buffer) {
  if (!bytes.length || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return 0;
  const text = bytes.toString('latin1');
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return pages ? Math.min(pages.length, 2000) : 0;
}
