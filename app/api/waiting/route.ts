import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false });
    const body = await req.json().catch(() => null);
    const sourceKey = String(body?.sourceKey || '').trim().slice(0, 180);
    if (!sourceKey) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await session.sql`
      INSERT INTO resolved_waiting (owner_id, source_key)
      VALUES (${session.userId}, ${sourceKey})
      ON CONFLICT (owner_id, source_key) DO NOTHING
    `;
    return NextResponse.json({ ok: true, sourceKey });
  } catch (err) {
    fail('waiting_failed', err);
    return NextResponse.json({ ok: false });
  }
}
