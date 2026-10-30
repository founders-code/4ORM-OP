import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner, teamWorkspaceOwner } from '@/lib/session';
import { NEWS_CHIPS, ensureNewsTables, lastSweptAt } from '@/lib/news-sweep';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war-core.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    /* Chad reads his own news; a team member (Bruce) reads the room's news. */
    const viewer = (await sessionOwner(session)) ? session.userId : await teamWorkspaceOwner(session);
    if (!viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES });
    await ensureNewsTables(session.sql).catch(() => {});
    const asked = new URL(req.url).searchParams.get('span');
    const span = asked === 'today' ? 1 : asked === 'week' ? 7 : 30;
    const items = await listNews(session.sql, viewer, undefined, span).catch((err) => { fail('news_list', err); return []; });
    const categories = await newsCategories(session.sql, viewer).catch(() => NEWS_CATEGORIES.slice());
    const sweptAt = await lastSweptAt(session.sql, viewer).catch(() => 0);
    return NextResponse.json({ items, chips: NEWS_CHIPS, categories, sweptAt });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ items: [], chips: NEWS_CHIPS, categories: NEWS_CATEGORIES }, { status: 500 });
  }
}
