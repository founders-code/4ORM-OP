import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const KEYS = [
  { key: 'send_rail', label: 'Send rail · GoHighLevel', sub: 'the only way mail leaves' },
  { key: 'morning_brief', label: 'Morning brief 06:00', sub: 'daily brief' },
  { key: 'market_pulse', label: 'Market pulse x4 a day', sub: '06:00 10:00 14:00 18:00' },
  { key: 'email_sweep', label: 'Email sweep every 15 s', sub: 'inbox poll' },
  { key: 'voice_log', label: 'Voice log transcription', sub: process.env.OPENAI_API_KEY ? 'OpenAI key set' : 'needs OPENAI_API_KEY' },
  { key: 'sayit_audit', label: 'Snapshot audit on Say it', sub: 'Apply' },
  { key: 'google_sync', label: 'Google two-way sync', sub: 'calendar and mail' },
  { key: 'iq_pull', label: 'Pull 4ormIQ control room', sub: 'every 5 minutes' },
  { key: 'readonly', label: 'Read-only mode', sub: 'confirm first' },
  { key: 'test_mode', label: 'Test mode · opstest only', sub: 'confirm first' },
];

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ switches: KEYS.map((k) => ({ ...k, on: true })) });
    if (new URL(req.url).searchParams.get('log') === '1') {
      const log = await session.sql`SELECT key, on_state, at FROM ops_switch_log ORDER BY at DESC LIMIT 60`.catch(() => []);
      return NextResponse.json({ log: (log as Array<Record<string, unknown>>).map((r) => ({ key: String(r.key), label: KEYS.find((k) => k.key === r.key)?.label || String(r.key), on: !!r.on_state, at: r.at })) });
    }
    const rows = await session.sql`SELECT key, on_state FROM ops_switches`;
    const map = new Map(rows.map((r) => [String(r.key), !!r.on_state]));
    return NextResponse.json({ switches: KEYS.map((k) => ({ ...k, on: map.has(k.key) ? !!map.get(k.key) : true })) });
  } catch (err) {
    fail('ops_switches_get', err);
    return NextResponse.json({ switches: KEYS.map((k) => ({ ...k, on: true })) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => null);
    const key = String(body?.key || '');
    const on = !!body?.on;
    if (!KEYS.some((k) => k.key === key)) return NextResponse.json({ saved: false }, { status: 400 });
    if (key === 'voice_log' && on && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ saved: false, error: 'Set the OpenAI key in Vercel to enable' }, { status: 400 });
    }
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    await session.sql`
      INSERT INTO ops_switches (key, on_state, changed_at, changed_by)
      VALUES (${key}, ${on}, now(), ${session.userId})
      ON CONFLICT (key) DO UPDATE SET on_state = EXCLUDED.on_state, changed_at = now(), changed_by = EXCLUDED.changed_by
    `;
    await session.sql`INSERT INTO ops_switch_log (key, on_state, by_user) VALUES (${key}, ${on}, ${session.userId})`;
    const { tape } = await import('@/lib/outbound');
    await tape('ok', 'switch', `${key} ${on ? 'on' : 'off'}`);
    return NextResponse.json({ saved: true, key, on });
  } catch (err) {
    fail('ops_switches_post', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
