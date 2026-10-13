import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { replaceNews } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [] });
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : null;
    if (!items) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const saved = await replaceNews(session.sql, session.userId, items);
    return NextResponse.json({ items: saved });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: [] });
  }
}
