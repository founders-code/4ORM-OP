import { NextResponse } from 'next/server';
import { allowStatus } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const status = body && Object.prototype.hasOwnProperty.call(body, 'status') ? allowStatus(String(body.status || '')) : '';
    if (body && Object.prototype.hasOwnProperty.call(body, 'status') && !status) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
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
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const rows = await session.sql`
      DELETE FROM items WHERE id = ${params.id} AND owner_id = ${session.userId} RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id: String((rows[0] as { id: string }).id) });
  } catch {
    fail('items_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
