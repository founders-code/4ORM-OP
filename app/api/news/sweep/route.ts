import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { NEWS_CHIPS, ensureNewsTables, runNewsSweep } from '@/lib/news-sweep';
import { cronSecret, newsKey } from '@/lib/secrets';
import { openBoard, roomOwner, sessionOwner } from '@/lib/session';
import { listNews, newsCategories } from '@/lib/war';
import { NEWS_CATEGORIES } from '@/lib/war-core.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SweepCaller = { sql: Awaited<ReturnType<typeof getSql>>; userId: string };

/**
 * Who may run a sweep. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the x-vercel-cron
 * header alone proves nothing (any client can set it) and is ignored. Otherwise the caller must be
 * a signed-in, allowlisted user (see sessionOwner).
 */
async function who(req: Request): Promise<SweepCaller | 'unauthorized' | 'forbidden'> {
  const key = req.headers.get('x-news-key');
  const header = req.headers.get('authorization') || '';
  const bearer = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (key || bearer) {
    const keyed = !!key && tokenOk(key, newsKey());
    const cron = !!bearer && tokenOk(bearer, cronSecret());
    if (!keyed && !cron) return 'unauthorized';
    const sql = await getSql();
    if (!sql) return 'unauthorized';
    const ownerId = await roomOwner(sql);
    return ownerId ? { sql, userId: ownerId } : 'unauthorized';
  }
  const session = await openBoard();
  if (!session) return 'unauthorized';
  const ownerId = await sessionOwner(session);
  if (!ownerId) return 'forbidden';
  return { sql: session.sql, userId: ownerId };
}

async function run(req: Request) {
  let session: SweepCaller | null = null;
  try {
    const caller = await who(req);
    if (caller === 'unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    session = caller;
    if (!session.sql) return NextResponse.json({ items: [], saved: 0, thumbs: 0, chips: NEWS_CHIPS, categories: NEWS_CATEGORIES, swept: false }, { status: 503 });
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
    return NextResponse.json({ items, saved: items.length, thumbs: 0, chips: NEWS_CHIPS, categories: NEWS_CATEGORIES, swept: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return run(req);
}

/** Vercel Cron is always GET. */
export async function GET(req: Request) {
  return run(req);
}
