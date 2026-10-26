import { NextResponse } from 'next/server';
import { allowStatus } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const status = body && Object.prototype.hasOwnProperty.call(body, 'status') ? allowStatus(String(body.status || '')) : '';
    if (body && Object.prototype.hasOwnProperty.call(body, 'status') && !status) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    // W39: drag to reorder inside Today saves a position (lower first). Additive column items.position.
    if (body && Object.prototype.hasOwnProperty.call(body, 'position')) {
      const raw = body.position;
      const position = raw === null ? null : Number(raw);
      if (position !== null && (!Number.isInteger(position) || position < 0 || position > 100000)) {
        return NextResponse.json({ error: 'Position must be a whole number' }, { status: 400 });
      }
      const moved = await session.sql`
        UPDATE items SET position = ${position}
        WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
        RETURNING id
      `;
      if (!moved.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
      if (!status) return NextResponse.json({ id: params.id, position });
    }
    if (!status) return NextResponse.json({ id: params.id, ok: true });
    const rows = await session.sql`
      UPDATE items
      SET status = ${status}, updated_at = now()
      WHERE id = ${params.id} AND owner_id = ${session.userId}
      RETURNING id, status
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id: String((rows[0] as { id: string }).id), status: String((rows[0] as { status: string }).status) });
  } catch (err) {
    fail('items_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    // Soft delete: dropped items are off every board read; deleted_at marks it as user-deleted (restorable).
    const rows = await session.sql`
      UPDATE items SET status = 'dropped', deleted_at = now(), updated_at = now()
      WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
      RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id: String((rows[0] as { id: string }).id) });
  } catch {
    fail('items_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
