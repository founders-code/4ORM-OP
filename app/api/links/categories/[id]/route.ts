import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ ok: false });
    const key = String(params.id || '').trim();
    const rows = ID.test(key)
      ? await session.sql`
          SELECT name FROM link_categories
          WHERE id = ${key} AND owner_id = ${session.userId}
          LIMIT 1
        `
      : await session.sql`
          SELECT name FROM link_categories
          WHERE owner_id = ${session.userId} AND name = ${key.slice(0, 80)}
          LIMIT 1
        `;
    const name = String(rows[0]?.name || '');
    if (!name || name === 'Uncategorized') return NextResponse.json({ ok: false });
    await session.sql`
      UPDATE links SET category = 'Uncategorized', sub = ''
      WHERE owner_id = ${session.userId} AND category = ${name}
    `;
    await session.sql`
      INSERT INTO link_categories (owner_id, name, subs)
      VALUES (${session.userId}, 'Uncategorized', '{}')
      ON CONFLICT (owner_id, name) DO NOTHING
    `;
    await session.sql`
      DELETE FROM link_categories
      WHERE owner_id = ${session.userId} AND name = ${name} AND name <> 'Uncategorized'
    `;
    return NextResponse.json({ ok: true, moved: 'Uncategorized' });
  } catch (err) {
    fail('links_category_delete', err);
    return NextResponse.json({ ok: false });
  }
}
