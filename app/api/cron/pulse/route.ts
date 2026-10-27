import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { buildPulse, isPulseHour, savePulse } from '@/lib/news-pulse';
import { cronSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPulseHour()) return NextResponse.json({ ok: true, skipped: true });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true });
    await sql`CREATE TABLE IF NOT EXISTS news_pulse_cache (
      owner_id text NOT NULL,
      view text NOT NULL,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, view)
    )`.catch(() => {});
    const market = await buildPulse(sql, ownerId, 'market');
    const consumer = await buildPulse(sql, ownerId, 'consumer');
    await savePulse(sql, ownerId, 'market', market);
    await savePulse(sql, ownerId, 'consumer', consumer);
    return NextResponse.json({ ok: true, updated: market.updated });
  } catch (err) {
    fail('pulse_cron', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
