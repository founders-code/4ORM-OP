import { NextResponse } from 'next/server';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { organizeText } from '@/lib/organize.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function inbox(sql: NeonQueryFunction<false, false>, userId: string) {
  const found = await sql`
    SELECT id FROM note_cats
    WHERE owner_id = ${userId} AND parent_id IS NULL AND name = 'Inbox'
    LIMIT 1
  `;
  if (found[0]?.id) return String(found[0].id);
  const made = await sql`
    INSERT INTO note_cats (owner_id, name, parent_id, depth)
    VALUES (${userId}, 'Inbox', NULL, 0)
    RETURNING id
  `;
  return String(made[0].id);
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const organized = organizeText(String(body?.text || ''));
    if (!organized) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const catId = await inbox(session.sql, session.userId);
    const made = await session.sql`
      INSERT INTO notes (owner_id, cat_id, title, body, color)
      VALUES (${session.userId}, ${catId}, ${organized.title}, ${organized.body}, 'yellow')
      RETURNING id, cat_id, title, body, color, updated_at
    `;
    const row = made[0];
    return NextResponse.json({
      id: String(row.id),
      catId: row.cat_id ? String(row.cat_id) : null,
      title: String(row.title || ''),
      body: String(row.body || ''),
      color: String(row.color || 'yellow'),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : null,
    });
  } catch {
    fail('notes_organize_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
