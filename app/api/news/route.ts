import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { sweepNews } from '@/lib/news-sweep';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES, todayKey } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
    let items = await listNews(session.sql, session.userId);
    const fresh = items.some((item) => item.sweptOn === todayKey());
    if (!fresh) {
      try {
        items = await sweepNews(session.sql, session.userId);
      } catch (err) {
        fail('news_sweep', err);
      }
    }
    const categories = await newsCategories(session.sql, session.userId);
    return NextResponse.json({ items, categories });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
  }
}
