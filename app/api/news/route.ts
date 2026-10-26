import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { NEWS_CHIPS, ensureNewsTables, lastSweptAt } from '@/lib/news-sweep';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war-core.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
    await ensureNewsTables(session.sql).catch(() => {});
    const asked = new URL(req.url).searchParams.get('span');
    const span = asked === 'today' ? 1 : asked === 'week' ? 7 : 30;
    const items = await listNews(session.sql, session.userId, undefined, span).catch((err) => { fail('news_list', err); return []; });
    const categories = await newsCategories(session.sql, session.userId).catch(() => NEWS_CATEGORIES.slice());
    const sweptAt = await lastSweptAt(session.sql, session.userId).catch(() => 0);
    return NextResponse.json({ items, chips: NEWS_CHIPS, categories, sweptAt });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
  }
}
