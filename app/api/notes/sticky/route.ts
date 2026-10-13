import { NextResponse } from 'next/server';
import { allowNoteColor } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

function shape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    body: String(row.body || ''),
    color: String(row.color || 'yellow'),
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
  };
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ notes: [] });
    const rows = await session.sql`
      SELECT id, body, color, x, y FROM sticky_notes WHERE owner_id = ${session.userId} ORDER BY created_at
    `;
    return NextResponse.json({ notes: (rows as Record<string, unknown>[]).map(shape) });
  } catch (err) {
    fail('sticky', err);
    return NextResponse.json({ notes: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Could not add that note.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const text = String(body?.body || '').slice(0, 2000);
    const color = allowNoteColor(String(body?.color || 'yellow')) || 'yellow';
    const rows = await session.sql`
      INSERT INTO sticky_notes (owner_id, body, color, x, y)
      VALUES (${session.userId}, ${text}, ${color}, ${Number(body?.x) || 24}, ${Number(body?.y) || 24})
      RETURNING id, body, color, x, y
    `;
    return NextResponse.json(shape(rows[0] as Record<string, unknown>));
  } catch (err) {
    fail('sticky', err);
    return NextResponse.json({ error: 'Could not add that note.' }, { status: 400 });
  }
}
