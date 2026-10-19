import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { NEWS_CHIPS, ensureNewsTables, runNewsSweep } from '@/lib/news-sweep';
import { cronSecret, newsKey } from '@/lib/secrets';
import { openBoard, roomOwner } from '@/lib/session';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war-core.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function who(req: Request) {
  const vercelCron = req.headers.get('x-vercel-cron');
  const key = req.headers.get('x-news-key');
  const header = req.headers.get('authorization') || '';
  const bearer = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (key || bearer || vercelCron) {
    const keyed = key && newsKey() && tokenOk(key, newsKey());
    const cron = (bearer && cronSecret() && tokenOk(bearer, cronSecret())) || !!vercelCron;
    if (!keyed && !cron) return null;
    const sql = await getSql();
    if (!sql) return null;
    const ownerId = await roomOwner(sql);
    return ownerId ? { sql, userId: ownerId } : null;
  }
  const session = await openBoard();
  if (!session) return null;
  return { sql: session.sql, userId: session.userId };
}

async function run(req: Request) {
  let session: { sql: Awaited<ReturnType<typeof getSql>>; userId: string } | null = null;
  try {
    session = await who(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ items: [], saved: 0, thumbs: 0, chips: NEWS_CHIPS, categories: NEWS_CATEGORIES, swept: false });
    await ensureNewsTables(session.sql).catch(() => {});
    const capSec = Number(process.env.AWS_LAMBDA_FUNCTION_TIMEOUT || 60);
    const left = Math.max(7000, Math.min(55000, (Number.isFinite(capSec) ? capSec : 60) * 1000 - 1500));
    const result = await runNewsSweep(session.sql, session.userId, left);
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
    fail('news_sweep_route', err);
    let items: unknown[] = [];
    try {
      if (session?.sql && session.userId) items = await listNews(session.sql, session.userId);
    } catch {
      items = [];
    }
    return NextResponse.json({ items, saved: items.length, thumbs: 0, chips: NEWS_CHIPS, categories: NEWS_CATEGORIES, swept: false });
  }
}

export async function POST(req: Request) {
  return run(req);
}

/** Vercel Cron is always GET. */
export async function GET(req: Request) {
  return run(req);
}
