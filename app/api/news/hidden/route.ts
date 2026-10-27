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
    if (!session.sql) return NextResponse.json({ ids: [] });
    const rows = await session.sql`SELECT item_id FROM news_hidden WHERE owner_id = ${ownerId}`;
    return NextResponse.json({ ids: rows.map((r) => String(r.item_id || '')) });
  } catch (err) {
    fail('news_hidden_get', err);
    return NextResponse.json({ ids: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || body?.item_id || '');
    const undo = !!body?.undo;
    if (!id || !session.sql) return NextResponse.json({ saved: false }, { status: 400 });
    if (undo) await session.sql`DELETE FROM news_hidden WHERE owner_id = ${ownerId} AND item_id = ${id}`;
    else {
      await session.sql`
        INSERT INTO news_hidden (owner_id, item_id) VALUES (${ownerId}, ${id})
        ON CONFLICT (owner_id, item_id) DO NOTHING
      `;
    }
    return NextResponse.json({ saved: true, id, undo });
  } catch (err) {
    fail('news_hidden_post', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
