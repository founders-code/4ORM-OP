import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { deleteSpaceItem, patchSpaceItem, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ saved: false });
    const saved = await patchSpaceItem(session.sql, session.userId, params.id, params.itemId, body);
    if (!saved) return NextResponse.json({ saved: false });
    return NextResponse.json(saved);
  } catch (err) {
    fail('spaces_item', err);
    return NextResponse.json({ saved: false });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ ok: false });
    const saved = await deleteSpaceItem(session.sql, session.userId, params.id, params.itemId);
    return NextResponse.json({ ok: !!saved, package: saved });
  } catch (err) {
    fail('spaces_item', err);
    return NextResponse.json({ ok: false });
  }
}
