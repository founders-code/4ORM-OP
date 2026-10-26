import type { NeonQueryFunction } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Sql = NeonQueryFunction<false, false>;

async function ensureAlarms(sql: Sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS meeting_alarms (
      owner_id text NOT NULL,
      event_id text NOT NULL,
      muted boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, event_id)
    )`;
  } catch (err) {
    fail('meeting_alarms_table', err);
  }
}

function empty() {
  return NextResponse.json({ ok: true, muted: [] as string[] });
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ ok: false, muted: [], error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return empty();
    await ensureAlarms(session.sql);
    const rows = await session.sql`
      SELECT event_id, muted FROM meeting_alarms WHERE owner_id = ${session.userId}
    `;
    const muted = rows.filter((row) => row.muted).map((row) => String(row.event_id || '')).filter(Boolean);
    return NextResponse.json({ ok: true, muted });
  } catch (err) {
    fail('alarms_get', err);
    return empty();
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ ok: false, muted: [], error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return empty();
    const body = await req.json().catch(() => null);
    const eventId = String(body?.eventId || '').slice(0, 200);
    const muted = !!body?.muted;
    if (!eventId) return empty();
    await ensureAlarms(session.sql);
    await session.sql`
      INSERT INTO meeting_alarms (owner_id, event_id, muted)
      VALUES (${session.userId}, ${eventId}, ${muted})
      ON CONFLICT (owner_id, event_id) DO UPDATE SET muted = EXCLUDED.muted
    `;
    const rows = await session.sql`
      SELECT event_id, muted FROM meeting_alarms WHERE owner_id = ${session.userId}
    `;
    const list = rows.filter((row) => row.muted).map((row) => String(row.event_id || '')).filter(Boolean);
    return NextResponse.json({ ok: true, muted: list });
  } catch (err) {
    fail('alarms_post', err);
    return empty();
  }
}
