import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { patchReach } from '@/lib/reach';
import { openBoard, sessionEmail, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ id: params.id, saved: false }, { status: 503 });
    const email = await sessionEmail(session);
    const person = await patchReach(session.sql, ownerId, params.id, body, {
      userId: session.userId,
      email,
    });
    if (!person) return NextResponse.json({ id: params.id, saved: false }, { status: 404 });
    return NextResponse.json(person);
  } catch (err) {
    fail('reach_patch', err);
    return NextResponse.json({ id: params.id, saved: false }, { status: 500 });
  }
}
