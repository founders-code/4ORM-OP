import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { withCreds } from '@/lib/creds';
import { isBriefHour, tokenOk, windowKey } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { cronSecret, ingestToken } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { calendarPayload, ingestMail, syncCalendar, syncGhl, writeBrief } from '@/lib/sync';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, cronSecret())) {
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
    const creds = await loadCredsFor(ownerId);
    const mail = await withCreds(creds, async () => {
      const pulled = await ingestMail(sql, ownerId, true);
      await syncCalendar(sql, ownerId, true);
      await syncGhl(sql, ownerId, true);
      return pulled;
    });
    const token = ingestToken();
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
    if (host && token && mail.items.length) {
      await fetch(`https://${host}/api/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ingest-token': token,
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
