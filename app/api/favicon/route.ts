import { NextResponse } from 'next/server';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { type: string; bytes: Buffer; at: number }>();
const DAY = 24 * 60 * 60 * 1000;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export async function GET(req: Request) {
  const session = await openBoard();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const raw = String(url.searchParams.get('d') || '').trim().toLowerCase().replace(/^www\./, '');
  if (!HOST.test(raw)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < DAY) {
    return new NextResponse(new Uint8Array(hit.bytes), {
      headers: { 'content-type': hit.type, 'cache-control': 'private, max-age=86400' },
    });
  }
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(raw)}&sz=128`;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    const type = res.headers.get('content-type') || 'image/png';
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 20) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    cache.set(raw, { type, bytes, at: Date.now() });
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'content-type': type, 'cache-control': 'private, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
  }
}
