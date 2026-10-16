import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { FALLBACK, sweepIfDue } from '@/lib/news-sweep';
import { openBoard } from '@/lib/session';
import { listNews, newsCategories, replaceNews } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
    await sweepIfDue(session.sql, session.userId, true, 15000).catch((err) => fail('news_refresh', err));
    let items = await listNews(session.sql, session.userId).catch(() => []);
    if (!items.length) items = await replaceNews(session.sql, session.userId, FALLBACK).catch(() => []);
    const categories = await newsCategories(session.sql, session.userId).catch(() => NEWS_CATEGORIES.slice());
    return NextResponse.json({ items, categories });
  } catch (err) {
    fail('news_refresh', err);
    return NextResponse.json({ items: [], categories: NEWS_CATEGORIES });
  }
}
