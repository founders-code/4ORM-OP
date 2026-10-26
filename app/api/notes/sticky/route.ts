import { NextResponse } from 'next/server';
import { allowNoteColor } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

function shape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    body: String(row.body || ''),
    color: String(row.color || 'yellow'),
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    w: Number(row.w) || 180,
    h: Number(row.h) || 120,
    meta: row.meta && typeof row.meta === 'object' ? row.meta : {},
  };
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ notes: [] });
    const rows = await session.sql`
      SELECT id, body, color, x, y, w, h, meta FROM sticky_notes WHERE owner_id = ${session.userId} AND deleted_at IS NULL ORDER BY created_at
    `;
    return NextResponse.json({ notes: (rows as Record<string, unknown>[]).map(shape) });
  } catch (err) {
    fail('sticky', err);
    return NextResponse.json({ notes: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = await req.json().catch(() => null);
    const text = String(body?.body || '').slice(0, 2000);
    const color = allowNoteColor(String(body?.color || 'yellow')) || 'yellow';
    const meta = JSON.stringify(body?.meta && typeof body.meta === 'object' ? body.meta : {});
    const rows = await session.sql`
      INSERT INTO sticky_notes (owner_id, body, color, x, y, w, h, meta)
      VALUES (${session.userId}, ${text}, ${color}, ${Number(body?.x) || 24}, ${Number(body?.y) || 24}, ${Number(body?.w) || 180}, ${Number(body?.h) || 120}, ${meta}::jsonb)
      RETURNING id, body, color, x, y, w, h, meta
    `;
    return NextResponse.json(shape(rows[0] as Record<string, unknown>));
  } catch (err) {
    fail('sticky', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
