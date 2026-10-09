import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { isBriefHour, tokenOk, windowKey } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { roomOwner } from '@/lib/session';
import { calendarPayload, ingestMail, syncCalendar, syncGhl, writeBrief } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isBriefHour()) return NextResponse.json({ ok: true });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true });
    const claimed = await sql`
      INSERT INTO ingest_guard (owner_id, window_key)
      VALUES (${ownerId}, ${`brief-${windowKey()}`})
      ON CONFLICT DO NOTHING
      RETURNING owner_id
    `;
    if (!claimed.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const mail = await ingestMail(sql, ownerId, true);
    await syncCalendar(sql, ownerId, true);
    await syncGhl(sql, ownerId, true);
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
    if (host && process.env.INGEST_TOKEN && mail.items.length) {
      await fetch(`https://${host}/api/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ingest-token': process.env.INGEST_TOKEN,
        },
        body: JSON.stringify({ items: mail.items }),
      });
    }
    const events = (await calendarPayload(sql, ownerId)) as Array<{ title?: string; start?: number }>;
    const soon = Date.now() + 36 * 60 * 60 * 1000;
    const eventTitles = events
      .filter((event) => Number(event.start) >= Date.now() && Number(event.start) <= soon)
      .map((event) => String(event.title || ''))
      .filter(Boolean);
    await writeBrief(sql, ownerId, [...mail.titles, ...eventTitles], ['gmail', 'calendar', 'ghl']);
    return NextResponse.json({ ok: true });
  } catch {
    fail('brief_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
