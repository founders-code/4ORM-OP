import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ logs: [] });
    await session.sql`CREATE TABLE IF NOT EXISTS voice_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      audio_url text,
      duration_s int,
      transcript text,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      destination text,
      saved boolean NOT NULL DEFAULT false
    )`;
    const rows = await session.sql`
      SELECT id, created_at, audio_url, duration_s, transcript, items, destination, saved
      FROM voice_logs WHERE owner_id = ${session.userId}
      ORDER BY created_at DESC LIMIT 20
    `;
    return NextResponse.json({ logs: rows });
  } catch (err) {
    fail('voice_logs', err);
    return NextResponse.json({ logs: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false }, { status: 503 });
    await session.sql`CREATE TABLE IF NOT EXISTS voice_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      audio_url text,
      duration_s int,
      transcript text,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      destination text,
      saved boolean NOT NULL DEFAULT false
    )`;
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const transcript = String(body?.transcript || '').slice(0, 8000);
    const destination = String(body?.destination || "Today's log").slice(0, 80);
    const items = JSON.stringify(body?.items || []);
    const duration = Math.max(0, Number(body?.duration_s) || 0);
    const rows = await session.sql`
      INSERT INTO voice_logs (owner_id, duration_s, transcript, items, destination, saved)
      VALUES (${session.userId}, ${duration}, ${transcript}, ${items}::jsonb, ${destination}, true)
      RETURNING id, created_at
    `;
    return NextResponse.json({ ok: true, id: rows[0]?.id, created_at: rows[0]?.created_at });
  } catch (err) {
    fail('voice_logs_save', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
