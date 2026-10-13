import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { listNews, newsCategories } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const [items, categories] = await Promise.all([
      listNews(session.sql, session.userId),
      newsCategories(session.sql, session.userId),
    ]);
    return NextResponse.json({ items, categories });
  } catch {
    fail('news_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
