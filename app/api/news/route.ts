import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { listNews, newsCategories } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], categories: [] });
    const [items, categories] = await Promise.all([
      listNews(session.sql, session.userId),
      newsCategories(session.sql, session.userId),
    ]);
    return NextResponse.json({ items, categories });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: [], categories: [] });
  }
}
