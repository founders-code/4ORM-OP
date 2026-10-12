import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const rows = await session.sql`
      DELETE FROM items WHERE id = ${params.id} AND owner_id = ${session.userId} RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id: String((rows[0] as { id: string }).id) });
  } catch {
    fail('items_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
