import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { listCommitments, setCommitment } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ commitments: [] }, { status: 503 });
    const updated = await setCommitment(session.sql, session.userId, params.id, 'done');
    if (!updated) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json({ commitments: await listCommitments(session.sql, session.userId) });
  } catch (err) {
    fail('commitments_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
