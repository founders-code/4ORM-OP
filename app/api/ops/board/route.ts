import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const lamps = [
      { key: 'front', name: 'FRONT END', reading: 'serving', color: 'green' },
      { key: 'db', name: 'DATABASE', reading: session.sql ? 'connected' : 'no url', color: session.sql ? 'green' : 'red' },
      { key: 'sign', name: 'SIGN-IN', reading: 'Clerk session', color: 'green' },
      { key: 'cron', name: 'CRON', reading: '-', color: 'grey' },
      { key: 'keys', name: 'KEYS', reading: process.env.OPENAI_API_KEY ? 'present' : 'OpenAI missing', color: process.env.OPENAI_API_KEY ? 'green' : 'amber' },
      { key: 'send', name: 'SEND RAIL', reading: 'armed', color: 'green' },
      { key: 'transcribe', name: 'TRANSCRIBE', reading: process.env.OPENAI_API_KEY ? 'ready' : 'off', color: process.env.OPENAI_API_KEY ? 'green' : 'grey' },
      { key: 'backup', name: 'BACKUP', reading: '-', color: 'grey' },
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
