import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { deleteSpaceRecipient, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string; rid: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ ok: false }, { status: session.sql ? 400 : 503 });
    const saved = await deleteSpaceRecipient(session.sql, session.userId, params.id, params.rid);
    return NextResponse.json({ ok: !!saved, package: saved }, saved ? undefined : { status: 404 });
  } catch (err) {
    fail('spaces_recipient', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
