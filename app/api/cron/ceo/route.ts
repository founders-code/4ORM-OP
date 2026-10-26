import { NextResponse } from 'next/server';
import { dailyCeo } from '@/lib/ceo';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { cronSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function pacificHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return parts.find((part) => part.type === 'hour')?.value || '';
}

export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (pacificHour() !== '06') return NextResponse.json({ ok: true, skipped: true });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true });
    await dailyCeo(sql, ownerId, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('ceo_cron', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
