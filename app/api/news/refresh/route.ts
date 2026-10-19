import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { NEWS_CHIPS, ensureNewsTables, runNewsSweep } from '@/lib/news-sweep';
import { openBoard } from '@/lib/session';
import { newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war-core.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
    await ensureNewsTables(session.sql).catch(() => {});
    const result = await runNewsSweep(session.sql, session.userId, 55000);
    const categories = await newsCategories(session.sql, session.userId).catch(() => NEWS_CATEGORIES.slice());
    return NextResponse.json({
      items: result.items,
      saved: result.saved,
      thumbs: result.thumbs,
      found: result.saved,
      chips: NEWS_CHIPS,
      categories,
      swept: true,
      sweptAt: Date.now(),
    });
  } catch (err) {
    fail('news_refresh', err);
    return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
  }
}
