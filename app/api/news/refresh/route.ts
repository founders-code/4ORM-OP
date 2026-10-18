import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { NEWS_CHIPS, ensureNewsTables, lastSweptAt, markSwept, sweepNews } from '@/lib/news-sweep';
import { openBoard } from '@/lib/session';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
    await ensureNewsTables(session.sql).catch(() => {});
    const last = await lastSweptAt(session.sql, session.userId).catch(() => 0);
    let swept = false;
    if (Date.now() - last > 60000) {
      await markSwept(session.sql, session.userId);
      await sweepNews(session.sql, session.userId, 50000).catch((err) => fail('news_refresh', err));
      swept = true;
    }
    let items = await listNews(session.sql, session.userId).catch(() => []);
    const categories = await newsCategories(session.sql, session.userId).catch(() => NEWS_CATEGORIES.slice());
    return NextResponse.json({ items, chips: NEWS_CHIPS, categories, swept, sweptAt: Date.now() });
  } catch (err) {
    fail('news_refresh', err);
    return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
  }
}
