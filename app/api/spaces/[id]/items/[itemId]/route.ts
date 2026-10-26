import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { deleteSpaceItem, patchSpaceItem, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !spaceIdOk(params.id) || !spaceIdOk(params.itemId)) {
      return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    }
    const rows = await session.sql`
      SELECT mime, body FROM space_items
      WHERE id = ${params.itemId} AND space_id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
      LIMIT 1
    `;
    const row = rows[0] as { mime?: string; body?: string } | undefined;
    const mime = String(row?.mime || '');
    const raw = String(row?.body || '');
    const previewable = mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/') || mime === 'text/csv';
    if (!raw || !previewable) return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    return new NextResponse(new Uint8Array(Buffer.from(raw, 'base64')), {
      headers: { 'content-type': mime, 'content-disposition': 'inline', 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' },
    });
  } catch (err) {
    fail('spaces_file', err);
    return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ ok: false });
    const saved = await deleteSpaceItem(session.sql, session.userId, params.id, params.itemId);
    return NextResponse.json({ ok: !!saved, package: saved });
  } catch (err) {
    fail('spaces_item', err);
    return NextResponse.json({ ok: false });
  }
}
