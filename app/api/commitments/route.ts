import { NextResponse } from 'next/server';
import { allowArea } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { listCommitments, setCommitment } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ commitments: [] });
    return NextResponse.json({ commitments: await listCommitments(session.sql, session.userId) });
  } catch (err) {
    fail('commitments_failed', err);
    return NextResponse.json({ commitments: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ commitments: [] }, { status: 503 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const action = String(body?.action || '');
    if (action === 'deck') {
      const rows = await session.sql`
        SELECT id, text FROM commitments WHERE id = ${id} AND owner_id = ${session.userId} LIMIT 1
      `;
      const row = rows[0] as { id?: string; text?: string } | undefined;
      if (!row?.id) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
      const area = allowArea(String(body?.area || 'follow_up')) || 'follow_up';
      await session.sql`
        INSERT INTO items (owner_id, title, area, status, priority, owner, source, plan_of)
        VALUES (${session.userId}, ${String(row.text || '').slice(0, 180)}, ${area}, 'new', 'high', 'Chad', 'plan', ${'commit:' + row.id})
      `;
      await setCommitment(session.sql, session.userId, id, 'decked');
      return NextResponse.json({ commitments: await listCommitments(session.sql, session.userId) });
    }
    const status = action === 'done' || body?.status === 'done' ? 'done' : 'open';
    const updated = await setCommitment(session.sql, session.userId, id, status);
    if (!updated) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ commitments: await listCommitments(session.sql, session.userId) });
  } catch (err) {
    fail('commitments_failed', err);
    return NextResponse.json({ commitments: [] }, { status: 500 });
  }
}
