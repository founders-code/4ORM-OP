import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { buildPulse, loadPulse, savePulse } from '@/lib/news-pulse';
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
    await session.sql`CREATE TABLE IF NOT EXISTS news_pulse_cache (
      owner_id text NOT NULL,
      view text NOT NULL,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, view)
    )`.catch(() => {});
    const stored = await loadPulse(session.sql, ownerId, view);
    if (stored) return NextResponse.json(Object.assign({ view }, stored));
    const pulse = await buildPulse(session.sql, ownerId, view);
    await savePulse(session.sql, ownerId, view, pulse);
    return NextResponse.json(Object.assign({ view }, pulse));
  } catch (err) {
    fail('news_pulse', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
