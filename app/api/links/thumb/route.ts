import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1)/i;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const id = new URL(req.url).searchParams.get('id') || '';
    const rows = await session.sql`SELECT thumb_url FROM links WHERE id = ${id}::uuid AND owner_id = ${session.userId} AND deleted_at IS NULL LIMIT 1`;
    const src = String(rows[0]?.thumb_url || '');
    if (!src) return NextResponse.json({ error: 'none' }, { status: 404 });
    const parsed = new URL(src);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return NextResponse.json({ error: 'scheme' }, { status: 400 });
    if (PRIVATE.test(parsed.hostname)) return NextResponse.json({ error: 'private' }, { status: 400 });
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(parsed.toString(), { signal: ac.signal, redirect: 'follow' });
    clearTimeout(t);
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 2 * 1024 * 1024 ? buf.slice(0, 2 * 1024 * 1024) : buf;
    const type = String(res.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return new NextResponse(Buffer.from(slice), {
      headers: {
        'content-type': type.startsWith('image/') ? type : 'image/jpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    fail('links_thumb', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
