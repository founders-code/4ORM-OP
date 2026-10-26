import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { saveNewsCategories } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ categories: [] });
    const body = await req.json().catch(() => null);
    const categories = await saveNewsCategories(session.sql, session.userId, body?.categories);
    return NextResponse.json({ categories });
  } catch (err) {
    fail('news_failed', err);
    return NextResponse.json({ categories: [] });
  }
}
