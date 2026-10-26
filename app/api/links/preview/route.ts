import type { NeonQueryFunction } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

type Sql = NeonQueryFunction<false, false>;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
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

async function fetchPage(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('scheme');
  if (blockedHost(parsed.hostname)) throw new Error('private');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  const res = await fetch(parsed.toString(), {
    signal: ac.signal,
    redirect: 'follow',
    headers: { 'user-agent': '4ormop-link-preview/1', accept: 'text/html,application/xhtml+xml' },
  });
  clearTimeout(t);
  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > 2 * 1024 * 1024 ? buf.slice(0, 2 * 1024 * 1024) : buf;
  return new TextDecoder('utf-8', { fatal: false }).decode(slice);
}

async function previewOne(sql: Sql, ownerId: string, id: string) {
  const rows = await sql`SELECT id, url, title, thumb_url FROM links WHERE id = ${id}::uuid AND owner_id = ${ownerId} AND deleted_at IS NULL LIMIT 1`;
  const row = rows[0];
  if (!row) return { ok: false, id, reason: 'missing' };
  try {
    const html = await fetchPage(String(row.url));
    const thumb = await pickAcceptedImage(html, String(row.url));
    const title = pickTitle(html) || String(row.title || '');
    await sql`UPDATE links SET thumb_url = ${thumb || null}, title = CASE WHEN ${!String(row.title || '') || String(row.title) === 'Untitled link'} THEN ${title} ELSE title END WHERE id = ${id}::uuid`;
    fail('links-thumb ok', id);
    return { ok: true, id, thumb: thumb || '', kind: thumb ? 'ok' : 'letter' };
  } catch (err) {
    fail('links-thumb failed', { id, err });
    await sql`UPDATE links SET thumb_url = NULL WHERE id = ${id}::uuid AND owner_id = ${ownerId}`;
    return { ok: false, id, reason: String((err as Error)?.message || err), kind: 'failed' };
  }
}

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    const backfill = url.searchParams.get('backfill') === '1' || url.searchParams.get('backfill') === 'all';
    const all = url.searchParams.get('backfill') === 'all';
    if (id) {
      const one = await previewOne(session.sql, session.userId, id);
      return NextResponse.json(one);
    }
    if (backfill) {
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
      const pending = all
        ? (await session.sql`
            SELECT id FROM links WHERE owner_id = ${session.userId} AND deleted_at IS NULL
            ORDER BY created_at DESC
          `).slice(offset, offset + 8)
        : await session.sql`
            SELECT id FROM links WHERE owner_id = ${session.userId} AND deleted_at IS NULL AND (thumb_url IS NULL OR thumb_url = '')
            ORDER BY created_at DESC LIMIT 3
          `;
      const results = [];
      for (const row of pending) results.push(await previewOne(session.sql, session.userId, String(row.id)));
      const ok = results.filter((r) => r.kind === 'ok').length;
      const letter = results.filter((r) => r.kind === 'letter').length;
      const failed = results.filter((r) => r.kind === 'failed' || !r.ok && r.kind !== 'letter').length;
      return NextResponse.json({
        n: results.length,
        results,
        ok,
        letter,
        failed,
        next: all && results.length === 8 ? offset + 8 : null,
      });
    }
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  } catch (err) {
    fail('links_preview', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
