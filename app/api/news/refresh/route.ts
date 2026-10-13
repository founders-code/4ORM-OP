import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { sweepNews } from '@/lib/news-sweep';
import { openBoard } from '@/lib/session';
import { newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
    const [items, categories] = await Promise.all([
      sweepNews(session.sql, session.userId),
      newsCategories(session.sql, session.userId),
    ]);
    return NextResponse.json({ items, categories });
  } catch (err) {
    fail('news_refresh', err);
    return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
  }
}
