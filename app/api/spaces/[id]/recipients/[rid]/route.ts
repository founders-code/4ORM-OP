import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { deleteSpaceRecipient, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string; rid: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ ok: false });
    const saved = await deleteSpaceRecipient(session.sql, session.userId, params.id, params.rid);
    return NextResponse.json({ ok: !!saved, package: saved });
  } catch (err) {
    fail('spaces_recipient', err);
    return NextResponse.json({ ok: false });
  }
}
