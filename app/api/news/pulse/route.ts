import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { buildPulse } from '@/lib/news-pulse';
import { ensureNewsTables } from '@/lib/news-sweep';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const view = new URL(req.url).searchParams.get('view') === 'consumer' ? 'consumer' : 'market';
    if (!session.sql) return NextResponse.json({ view, gauges: [], consumer: [], fear: [], cmkt: [], weeks: [], regs: [], mkt: [] });
    await ensureNewsTables(session.sql).catch(() => {});
    const pulse = await buildPulse(session.sql, ownerId, view);
    return NextResponse.json(Object.assign({ view }, pulse));
  } catch (err) {
    fail('news_pulse', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
