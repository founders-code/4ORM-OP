import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { markSwept } from '@/lib/news-sweep';
import { ingestToken } from '@/lib/secrets';
import { openBoard, roomOwner } from '@/lib/session';
import { replaceNews } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war.mjs';

export const dynamic = 'force-dynamic';

async function target(req: Request) {
  const presented = req.headers.get('x-ingest-token');
  if (presented) {
    if (!tokenOk(presented, ingestToken())) return null;
    const sql = await getSql();
    if (!sql) return null;
    const ownerId = await roomOwner(sql);
    return ownerId ? { sql, userId: ownerId } : null;
  }
  const session = await openBoard();
  if (!session || !session.sql) return session ? { sql: null, userId: session.userId } : null;
  return { sql: session.sql, userId: session.userId };
}

export async function POST(req: Request) {
  try {
    const who = await target(req);
    if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({})) as { items?: unknown } | unknown[];
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
    if (!who.sql) return NextResponse.json({ items: [], categories: NEWS_CATEGORIES, saved: false });
    const saved = await replaceNews(who.sql, who.userId, items as Array<Record<string, unknown>>);
    if (items.length) await markSwept(who.sql, who.userId);
    return NextResponse.json({ items: saved, saved: true });
  } catch (err) {
    fail('news_ingest', err);
    return NextResponse.json({ items: [], saved: false });
  }
}
