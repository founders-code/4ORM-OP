import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ saved: false });
    const note = String(body.note ?? '').slice(0, 2000);
    const title = String(body.title || '').trim().slice(0, 80);
    await session.sql`
      UPDATE links
      SET note = ${note},
          title = CASE WHEN ${!!title} THEN ${title || ''} ELSE title END
      WHERE id = ${params.id} AND owner_id = ${session.userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('links_failed', err);
    return NextResponse.json({ saved: false });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ ok: false });
    await session.sql`DELETE FROM links WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('links_failed', err);
    return NextResponse.json({ ok: false });
  }
}
