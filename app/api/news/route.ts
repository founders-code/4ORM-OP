import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { sweepNews } from '@/lib/news-sweep';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES, todayKey } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
    const span = new URL(req.url).searchParams.get('span') === 'month' ? 31 : 14;
    let items = await listNews(session.sql, session.userId, undefined, span);
    const fresh = items.some((item) => item.sweptOn === todayKey());
    if (!fresh) {
      try {
        await sweepNews(session.sql, session.userId);
        items = await listNews(session.sql, session.userId, undefined, span);
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
