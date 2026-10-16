import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { FALLBACK, NEWS_CHIPS, ensureNewsTables, lastSweptAt, sweepIfDue } from '@/lib/news-sweep';
import { listNews, newsCategories, replaceNews } from '@/lib/war';
import { NEWS_CATEGORIES, todayKey } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: seedNews(), chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
    await ensureNewsTables(session.sql).catch(() => {});
    const asked = new URL(req.url).searchParams.get('span');
    const span = asked === 'today' ? 1 : asked === 'week' ? 7 : 30;
    let items = await listNews(session.sql, session.userId, undefined, span).catch((err) => { fail('news_list', err); return []; });
    try {
      if (await sweepIfDue(session.sql, session.userId, !items.length)) {
        items = await listNews(session.sql, session.userId, undefined, span);
      }
    } catch (err) {
      fail('news_sweep', err);
    }
    if (!items.length) {
      try { items = await replaceNews(session.sql, session.userId, FALLBACK, todayKey()); } catch (err) { fail('news_seed', err); }
    }
    const categories = await newsCategories(session.sql, session.userId).catch(() => NEWS_CATEGORIES.slice());
    const sweptAt = await lastSweptAt(session.sql, session.userId).catch(() => 0);
    return NextResponse.json({ items: items.length ? items : seedNews(), chips: NEWS_CHIPS, categories, sweptAt });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: seedNews(), chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
  }
}

function seedNews() {
  const now = Date.now();
  return FALLBACK.map((item, index) => ({
    id: 'seed-' + index,
    category: String(item.category),
    title: String(item.title),
    summary: String(item.summary),
    whyItMatters: String(item.why_it_matters || ''),
    source: String(item.source || ''),
    impact: String(item.impact || ''),
    url: String(item.url),
    image: '',
    image_url: '',
    publishedAt: now,
    isTop: item.is_top === true,
    sweptOn: todayKey(),
  }));
}
