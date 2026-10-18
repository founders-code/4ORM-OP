import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { NEWS_CHIPS, ensureNewsTables, markSwept, saveStories } from '@/lib/news-sweep';
import { ingestToken, newsKey } from '@/lib/secrets';
import { openBoard, roomOwner } from '@/lib/session';
import { listNews } from '@/lib/war';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function target(req: Request) {
  const key = req.headers.get('x-news-key');
  const token = req.headers.get('x-ingest-token');
  if (key || token) {
    const expected = key ? newsKey() : ingestToken();
    if (!expected || !tokenOk(String(key || token), expected)) return null;
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
    const raw = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
    const items = raw.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object').slice(0, 60);
    if (!who.sql) return NextResponse.json({ ok: false, saved: 0, chips: NEWS_CHIPS });
    await ensureNewsTables(who.sql).catch(() => {});
    const result = await saveStories(who.sql, who.userId, items, Date.now() + 45000);
    const saved = typeof result === 'number' ? result : result.saved;
    if (items.length) await markSwept(who.sql, who.userId);
    const list = await listNews(who.sql, who.userId).catch(() => []);
    return NextResponse.json({ ok: true, saved, items: list });
  } catch (err) {
    fail('news_ingest', err);
    return NextResponse.json({ ok: false, saved: 0 });
  }
}
