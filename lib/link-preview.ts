import type { NeonQueryFunction } from '@neondatabase/serverless';
import { fail } from './log';
import { downloadImage, screenshotArticle } from './news-sources.mjs';

type Sql = NeonQueryFunction<false, false>;

export const LINK_IMAGE = '/api/links/image/';

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|fd|fc)/i;

function blockedHost(host: string) {
  const h = host.toLowerCase();
  if (PRIVATE.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

function abs(base: string, href: string) {
  try { return new URL(href, base).toString(); } catch { return ''; }
}

function imageCandidates(html: string, pageUrl: string) {
  const out: string[] = [];
  const push = (u: string) => { if (u && out.indexOf(u) < 0) out.push(u); };
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && og[1]) push(abs(pageUrl, og[1]));
  const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (tw && tw[1]) push(abs(pageUrl, tw[1]));
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((m) => abs(pageUrl, m[1])).filter(Boolean);
  imgs.sort((a, b) => b.length - a.length);
  for (const src of imgs) {
    if (/\.(svg|gif|ico)(\?|$)/i.test(src)) continue;
    if (/pixel|spacer|1x1|tracking|logo|favicon|sprite|icon/i.test(src)) continue;
    push(src);
  }
  return out;
}

function jpegWidth(buf: Buffer) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return buf.readUInt16BE(i + 7);
    }
    i += 2 + len;
  }
  return 0;
}

function pngWidth(buf: Buffer) {
  if (buf.length < 24) return 0;
  return buf.readUInt32BE(16);
}

function mostlyOneColour(buf: Buffer) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return false;
  const sample = buf.subarray(Math.min(buf.length, 80), Math.min(buf.length, 2800));
  if (sample.length < 64) return true;
  const counts = new Map<number, number>();
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    counts.set(b, (counts.get(b) || 0) + 1);
  }
  let max = 0;
  counts.forEach((n) => { if (n > max) max = n; });
  return max / sample.length > 0.9;
}

function imageWideEnough(buf: Buffer) {
  if (buf.length < 24) return false;
  let w = 0;
  if (buf[0] === 0x89 && buf[1] === 0x50) w = pngWidth(buf);
  else if (buf[0] === 0xff && buf[1] === 0xd8) w = jpegWidth(buf);
  else if (buf.toString('ascii', 8, 12) === 'WEBP') w = buf.readUInt16LE(26);
  if (w < 300) return false;
  if (mostlyOneColour(buf)) return false;
  return true;
}

async function fetchImage(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (blockedHost(parsed.hostname)) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': '4ormop-link-preview/1', accept: 'image/*,*/*' },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function pickAcceptedImage(html: string, pageUrl: string) {
  const list = imageCandidates(html, pageUrl);
  for (const src of list) {
    const buf = await fetchImage(src);
    if (buf && imageWideEnough(buf)) return src;
  }
  return '';
}

function pickTitle(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1].trim().slice(0, 180);
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return t ? t[1].trim().slice(0, 180) : '';
}

export async function fetchPage(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('scheme');
  if (blockedHost(parsed.hostname)) throw new Error('private');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': '4ormop-link-preview/1', accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) throw new Error('http_' + res.status);
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 2 * 1024 * 1024 ? buf.slice(0, 2 * 1024 * 1024) : buf;
    return new TextDecoder('utf-8', { fatal: false }).decode(slice);
  } finally {
    clearTimeout(t);
  }
}

/** Additive table for stored link preview bytes (Blob / bytea). */
export async function ensureLinkImages(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS link_images (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      source_url text NOT NULL,
      mime text NOT NULL,
      data bytea NOT NULL,
      bytes integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_id, source_url)
    )`;
    await sql`ALTER TABLE links ADD COLUMN IF NOT EXISTS thumb_status text`;
  } catch (err) {
    fail('link_images_ensure', err);
  }
}

/** Store image bytes; prefer Vercel Blob when BLOB_READ_WRITE_TOKEN is set, else Neon bytea. */
export async function storeLinkImage(sql: Sql, ownerId: string, src: string, referer = '') {
  if (!/^https?:\/\//i.test(src)) return '';
  const hit = await sql`SELECT id FROM link_images WHERE owner_id = ${ownerId} AND source_url = ${src.slice(0, 1000)} LIMIT 1`.catch(() => []);
  if (hit[0]?.id) return LINK_IMAGE + String(hit[0].id);

  const img = await downloadImage(src, referer).catch(() => null);
  if (!img) return '';

  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (token) {
    try {
      const path = `links/${ownerId.slice(0, 24)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch(`https://blob.vercel-storage.com/${path}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${token}`,
          'x-api-version': '7',
          'content-type': img.mime,
          'x-content-type': img.mime,
        },
        body: img.bytes,
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null) as { url?: string } | null;
        if (data?.url && /^https?:\/\//i.test(data.url)) return data.url;
      }
    } catch (err) {
      fail('link_blob_put', err);
    }
  }

  const rows = await sql`
    INSERT INTO link_images (owner_id, source_url, mime, data, bytes)
    VALUES (${ownerId}, ${src.slice(0, 1000)}, ${img.mime}, decode(${img.bytes.toString('base64')}, 'base64'), ${img.bytes.length})
    ON CONFLICT (owner_id, source_url) DO UPDATE SET mime = EXCLUDED.mime
    RETURNING id
  `;
  return rows[0]?.id ? LINK_IMAGE + String(rows[0].id) : '';
}

export type PreviewResult = {
  ok: boolean;
  id: string;
  thumb?: string;
  kind?: 'ok' | 'failed';
  reason?: string;
};

/** og:image / twitter / body img, else Microlink 1200x630 screenshot stored as blob. Letter only when the page will not load. */
export async function previewOne(sql: Sql, ownerId: string, id: string): Promise<PreviewResult> {
  await ensureLinkImages(sql);
  const rows = await sql`SELECT id, url, title, thumb_url FROM links WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL LIMIT 1`;
  const row = rows[0];
  if (!row) return { ok: false, id, reason: 'missing', kind: 'failed' };
  try {
    const html = await fetchPage(String(row.url));
    let thumb = await pickAcceptedImage(html, String(row.url));
    if (thumb) {
      const stored = await storeLinkImage(sql, ownerId, thumb, String(row.url)).catch(() => '');
      if (stored) thumb = stored;
    }
    if (!thumb) {
      const shot = await screenshotArticle(String(row.url)).catch(() => '');
      if (shot) {
        const stored = await storeLinkImage(sql, ownerId, shot, String(row.url)).catch(() => '');
        thumb = stored || shot;
      }
    }
    const title = pickTitle(html) || String(row.title || '');
    if (!thumb) {
      // Page loaded but no photo and screenshot failed — keep trying later; do not letter-tile.
      await sql`
        UPDATE links SET
          thumb_url = NULL,
          thumb_status = 'pending',
          title = CASE WHEN ${!String(row.title || '') || String(row.title) === 'Untitled link'} THEN ${title} ELSE title END
        WHERE id = ${id}::uuid AND owner_id = ${ownerId}
      `;
      fail('links-thumb pending', id);
      return { ok: true, id, thumb: '', kind: 'ok' };
    }
    await sql`
      UPDATE links SET
        thumb_url = ${thumb},
        thumb_status = 'ok',
        title = CASE WHEN ${!String(row.title || '') || String(row.title) === 'Untitled link'} THEN ${title} ELSE title END
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}
    `;
    fail('links-thumb ok', id);
    return { ok: true, id, thumb, kind: 'ok' };
  } catch (err) {
    fail('links-thumb failed', { id, err });
    await sql`
      UPDATE links SET thumb_url = NULL, thumb_status = 'failed'
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}
    `;
    return { ok: false, id, reason: String((err as Error)?.message || err), kind: 'failed' };
  }
}
