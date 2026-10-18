import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { cronSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { pacificDay, saveSnapshot } from '@/lib/snapshots';

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
  if (pacificHour() !== '23') return NextResponse.json({ ok: true, skipped: true });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true });
    const day = pacificDay();
    const claimed = await sql`
      INSERT INTO ingest_guard (owner_id, window_key)
      VALUES (${ownerId}, ${`snapshot-${day}`})
      ON CONFLICT DO NOTHING
      RETURNING owner_id
    `.catch((err) => {
      fail('snap_guard', err);
      return [];
    });
    if (!claimed.length) return NextResponse.json({ ok: true, skipped: true });
    await saveSnapshot(sql, ownerId, day);
    return NextResponse.json({ ok: true, date: day });
  } catch (err) {
    fail('snap_cron', err);
    return NextResponse.json({ ok: false });
  }
}
