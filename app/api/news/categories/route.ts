import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { saveNewsCategories } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const categories = await saveNewsCategories(session.sql, session.userId, body?.categories);
    return NextResponse.json({ categories });
  } catch {
    fail('news_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
