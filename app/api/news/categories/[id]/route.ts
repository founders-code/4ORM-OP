import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { newsCategories, saveNewsCategories } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ categories: [] });
    const name = decodeURIComponent(params.id || '').trim();
    const current = await newsCategories(session.sql, session.userId);
    const next = current.filter((item) => item !== name);
    const categories = await saveNewsCategories(session.sql, session.userId, next.length ? next : current);
    return NextResponse.json({ categories });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ categories: [] });
  }
}
