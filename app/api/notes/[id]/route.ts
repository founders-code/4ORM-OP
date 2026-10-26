import { NextResponse } from 'next/server';
import { allowNoteColor } from '@/lib/guard.mjs';
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
    const hasBody = !!(body && Object.prototype.hasOwnProperty.call(body, 'body'));
    const hasTitle = !!(body && Object.prototype.hasOwnProperty.call(body, 'title'));
    const text = hasBody ? String(body.body ?? '').slice(0, 4000) : '';
    const title = hasTitle ? (String(body.title || '').trim().slice(0, 180) || 'Note') : '';
    const color = body?.color == null ? '' : (allowNoteColor(String(body.color)) || '');
    const x = Number(body?.x);
    const y = Number(body?.y);
    const w = Number(body?.w);
    const h = Number(body?.h);
    const hasMeta = !!(body && body.meta && typeof body.meta === 'object');
    const meta = JSON.stringify(hasMeta ? body.meta : {});
    const board = await session.sql`
      UPDATE notes
      SET title = CASE WHEN ${hasTitle} THEN ${title} ELSE title END,
          body = CASE WHEN ${hasBody} THEN ${text} ELSE body END,
          updated_at = now()
      WHERE id = ${params.id} AND owner_id = ${session.userId}
      RETURNING id
    `;
    if (board.length) {
      return NextResponse.json({ ok: true, store: 'board', rowsAffected: board.length });
    }
    const sticky = await session.sql`
      UPDATE sticky_notes
      SET body = CASE WHEN ${hasBody} THEN ${text} ELSE body END,
          color = CASE WHEN ${!!color} THEN ${color || 'yellow'} ELSE color END,
          x = CASE WHEN ${Number.isFinite(x)} THEN ${Number.isFinite(x) ? Math.round(x) : 0} ELSE x END,
          y = CASE WHEN ${Number.isFinite(y)} THEN ${Number.isFinite(y) ? Math.round(y) : 0} ELSE y END,
          w = CASE WHEN ${Number.isFinite(w)} THEN ${Number.isFinite(w) ? Math.round(w) : 180} ELSE w END,
          h = CASE WHEN ${Number.isFinite(h)} THEN ${Number.isFinite(h) ? Math.round(h) : 120} ELSE h END,
          meta = CASE WHEN ${hasMeta} THEN ${meta}::jsonb ELSE meta END
      WHERE id = ${params.id} AND owner_id = ${session.userId}
      RETURNING id
    `;
    if (!sticky.length) return NextResponse.json({ error: 'Note not found.', rowsAffected: 0 }, { status: 404 });
    return NextResponse.json({ ok: true, store: 'sticky', rowsAffected: sticky.length });
  } catch (err) {
    fail('sticky', err);
    return NextResponse.json({ error: 'Could not update that note.' }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not delete that note.' }, { status: 400 });
    await session.sql`DELETE FROM sticky_notes WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('sticky', err);
    return NextResponse.json({ error: 'Could not delete that note.' }, { status: 400 });
  }
}
