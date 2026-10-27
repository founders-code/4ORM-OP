import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ docs: [] });
    const docs = await session.sql`
      SELECT id, org, kind, doc_id, name, version, status, verified_at, owner, note, source_url, drive_id, json_path
      FROM vault_docs WHERE owner_id = ${ownerId} ORDER BY name
    `;
    return NextResponse.json({ docs });
  } catch (err) {
    fail('vault_get', err);
    return NextResponse.json({ docs: [] }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ saved: false }, { status: 400 });
    const owner = body?.owner != null ? String(body.owner) : null;
    const note = body?.note != null ? String(body.note) : null;
    if (owner != null) await session.sql`UPDATE vault_docs SET owner = ${owner} WHERE id = ${id} AND owner_id = ${ownerId}`;
    if (note != null) await session.sql`UPDATE vault_docs SET note = ${note} WHERE id = ${id} AND owner_id = ${ownerId}`;
    return NextResponse.json({ saved: true });
  } catch (err) {
    fail('vault_patch', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
