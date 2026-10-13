import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ rows: [] });
    const rows = await session.sql`
      SELECT id, name, note, status, created_at
      FROM vc_inbox
      WHERE owner_id = ${session.userId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({
      rows: (rows as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        name: String(row.name || ''),
        note: String(row.note || ''),
        status: String(row.status || 'open'),
      })),
    });
  } catch (err) {
    fail('vc_inbox', err);
    return NextResponse.json({ rows: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Could not save that name.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const name = String(body?.name || '').trim().slice(0, 120);
    const note = String(body?.note || '').trim().slice(0, 500);
    if (!name) return NextResponse.json({ error: 'Could not save that name.' }, { status: 400 });
    const rows = await session.sql`
      INSERT INTO vc_inbox (owner_id, name, note, status)
      VALUES (${session.userId}, ${name}, ${note}, 'open')
      RETURNING id, name, note, status
    `;
    const row = rows[0] as Record<string, unknown>;
    return NextResponse.json({ id: String(row.id), name: String(row.name), note: String(row.note || ''), status: 'open' });
  } catch (err) {
    fail('vc_inbox', err);
    return NextResponse.json({ error: 'Could not save that name.' }, { status: 400 });
  }
}
