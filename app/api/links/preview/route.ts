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

function pickImage(html: string, pageUrl: string) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && og[1]) return abs(pageUrl, og[1]);
  const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (tw && tw[1]) return abs(pageUrl, tw[1]);
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
  for (const m of imgs) {
    const src = abs(pageUrl, m[1]);
    if (/\.(svg|gif|ico)(\?|$)/i.test(src)) continue;
    if (/pixel|spacer|1x1|tracking/i.test(src)) continue;
    return src;
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
    const thumb = pickImage(html, String(row.url));
    const title = pickTitle(html) || String(row.title || '');
    await sql`UPDATE links SET thumb_url = ${thumb || null}, title = CASE WHEN ${!String(row.title || '') || String(row.title) === 'Untitled link'} THEN ${title} ELSE title END WHERE id = ${id}::uuid`;
    fail('links-thumb ok', id);
    return { ok: true, id, thumb };
  } catch (err) {
    fail('links-thumb failed', { id, err });
    return { ok: false, id, reason: String((err as Error)?.message || err) };
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
    const backfill = url.searchParams.get('backfill') === '1';
    if (id) {
      const one = await previewOne(session.sql, session.userId, id);
      return NextResponse.json(one);
    }
    if (backfill) {
      const pending = await session.sql`
        SELECT id FROM links WHERE owner_id = ${session.userId} AND deleted_at IS NULL AND (thumb_url IS NULL OR thumb_url = '')
        ORDER BY created_at DESC LIMIT 3
      `;
      const results = [];
      for (const row of pending) results.push(await previewOne(session.sql, session.userId, String(row.id)));
      return NextResponse.json({ n: results.length, results });
    }
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  } catch (err) {
    fail('links_preview', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
