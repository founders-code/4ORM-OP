import { NextResponse } from 'next/server';
import { patchItem, readSection } from '@/lib/investor-update';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

/** Edit or soft-remove one item: { title?, body?, section?, position?, deleted?: boolean } (deleted:false = Undo). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    if (!ID.test(String(params?.id || ''))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const item = await patchItem(session.sql, ownerId, params.id, {
      title: body?.title != null ? String(body.title) : undefined,
      body: body?.body != null ? String(body.body) : undefined,
      section: body?.section != null ? readSection(body.section) : undefined,
      position: body?.position != null ? Number(body.position) : undefined,
      deleted: typeof body?.deleted === 'boolean' ? body.deleted : undefined,
    });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    fail('investor_update_item', err);
    return NextResponse.json({ error: 'That item could not be saved.' }, { status: 500 });
  }
}
