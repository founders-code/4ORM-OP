import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    /* Cron: the newest scheduled-job stamp. Live runs every 5 minutes, so older than 20 minutes is amber. */
    let cronAt = 0;
    if (session.sql) {
      try {
        const ownerId = await sessionOwner(session);
        const row = (await session.sql`SELECT max(synced_at) AS at FROM sync_state WHERE owner_id = ${ownerId} OR owner_id = ${session.userId}`)[0] as { at?: string } | undefined;
        cronAt = row?.at ? new Date(String(row.at)).getTime() : 0;
      } catch { cronAt = 0; }
    }
    const cronAge = cronAt ? (Date.now() - cronAt) / 60000 : Infinity;
    const cronRead = cronAt ? 'ran ' + new Date(cronAt).toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : 'no run yet';
    const lamps = [
      { key: 'front', name: 'FRONT END', reading: 'serving', color: 'green' },
      { key: 'db', name: 'DATABASE', reading: session.sql ? 'connected' : 'no url', color: session.sql ? 'green' : 'red' },
      { key: 'sign', name: 'SIGN-IN', reading: 'Clerk session', color: 'green' },
      { key: 'cron', name: 'CRON', reading: cronRead, color: cronAge <= 20 ? 'green' : cronAge <= 120 ? 'amber' : 'red' },
      { key: 'keys', name: 'KEYS', reading: process.env.OPENAI_API_KEY ? 'present' : 'OpenAI missing', color: process.env.OPENAI_API_KEY ? 'green' : 'amber' },
      { key: 'send', name: 'SEND RAIL', reading: 'armed', color: 'green' },
      { key: 'transcribe', name: 'TRANSCRIBE', reading: process.env.OPENAI_API_KEY ? 'ready' : 'off', color: process.env.OPENAI_API_KEY ? 'green' : 'grey' },
      { key: 'backup', name: 'BACKUP', reading: session.sql ? 'Neon restore points' : 'no database', color: session.sql ? 'green' : 'grey' },
    ];
    const worst = lamps.some((l) => l.color === 'red') ? 'DOWN' : lamps.some((l) => l.color === 'amber') ? 'DEGRADED' : 'NOMINAL';
    return NextResponse.json({
      master: { state: worst.toLowerCase(), label: worst, since: new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Vancouver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) },
      lamps,
    });
  } catch (err) {
    fail('ops_board', err);
    return NextResponse.json({ master: { state: 'down', label: 'DOWN' }, lamps: [] }, { status: 500 });
  }
}
