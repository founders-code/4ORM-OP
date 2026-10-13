import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not update that note.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const title = String(body?.title || '').trim().slice(0, 180);
    if (!title) return NextResponse.json({ error: 'Could not update that note.' }, { status: 400 });
    const others = JSON.stringify(String(body?.others || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 40));
    await session.sql`
      UPDATE zoom_notes
      SET title = ${title}, others = ${others}::jsonb
      WHERE id = ${params.id} AND owner_id = ${session.userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('zoom_note', err);
    return NextResponse.json({ error: 'Could not update that note.' }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not delete that note.' }, { status: 400 });
    await session.sql`DELETE FROM zoom_notes WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('zoom_note', err);
    return NextResponse.json({ error: 'Could not delete that note.' }, { status: 400 });
  }
}
