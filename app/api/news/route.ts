import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { FALLBACK, sweepNews } from '@/lib/news-sweep';
import { listNews, newsCategories, replaceNews } from '@/lib/war';
import { NEWS_CATEGORIES, todayKey } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: seedNews(), categories: NEWS_CATEGORIES });
    const span = new URL(req.url).searchParams.get('span') === 'week' ? 7 : 30;
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
    if (!items.length) {
      try { items = await replaceNews(session.sql, session.userId, FALLBACK, todayKey()); } catch (err) { fail('news_seed', err); }
    }
    const categories = await newsCategories(session.sql, session.userId);
    return NextResponse.json({ items: items.length ? items : seedNews(), categories });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: seedNews(), categories: NEWS_CATEGORIES });
  }
}

function seedNews() {
  const now = Date.now();
  return FALLBACK.map((item, index) => ({
    id: 'seed-' + index,
    category: item.category,
    title: item.title,
    summary: item.summary,
    url: item.url,
    image: '',
    publishedAt: now,
    isTop: item.is_top,
    sweptOn: todayKey(),
  }));
}
