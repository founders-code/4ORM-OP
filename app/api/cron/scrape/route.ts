import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { ensureScrapeTable, runScrape, scrapeSlot } from '@/lib/scrape';
import { cronSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel Cron, three times a day: 06:00, 12:00 and 18:00 Vancouver (both UTC hours are scheduled for daylight time). */
export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, cronSecret())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const slot = scrapeSlot();
  if (!slot) return NextResponse.json({ ok: true, skipped: 'not a scrape hour' });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true, skipped: 'no owner' });
    await ensureScrapeTable(sql);
    const done = await sql`SELECT 1 FROM scrape_runs WHERE owner_id = ${ownerId} AND slot = ${slot} AND status = 'ok' LIMIT 1`;
    if (done.length) return NextResponse.json({ ok: true, skipped: 'already ran', slot });
    const r = await runScrape(sql, ownerId, slot, 'cron', 52000);
    return NextResponse.json({ slot, ...r, ran: true });
  } catch (err) {
    fail('scrape_cron', err);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
