import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { runScrape, scrapeAudit } from '@/lib/scrape';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Control room: the scrape audit (3 a day) and the missed-run alert. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ slots: [], alert: 'Database unavailable' }, { status: 503 });
    return NextResponse.json(await scrapeAudit(session.sql, ownerId, 7));
  } catch (err) {
    fail('scrape_audit', err);
    return NextResponse.json({ slots: [], alert: 'Audit unavailable' }, { status: 500 });
  }
}

/** Run now (logged as a manual run in the current slot label). */
export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const d = new Date();
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value || '00';
    const slot = `${g('year')}-${g('month')}-${g('day')} manual ${g('hour')}:${g('minute')}`;
    const r = await runScrape(session.sql, ownerId, slot, 'manual', 50000);
    return NextResponse.json({ ...r, ran: true });
  } catch (err) {
    fail('scrape_manual', err);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
