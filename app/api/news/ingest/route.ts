import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { replaceNews } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({})) as { items?: unknown } | unknown[];
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
    if (!session.sql) return NextResponse.json({ items: [], categories: NEWS_CATEGORIES, saved: false });
    const saved = await replaceNews(session.sql, session.userId, items as Array<Record<string, unknown>>);
    return NextResponse.json({ items: saved, saved: true });
  } catch (err) {
    fail('news_ingest', err);
    return NextResponse.json({ items: [], saved: false });
  }
}
