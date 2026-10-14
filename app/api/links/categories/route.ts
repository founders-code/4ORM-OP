import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

function clean(value: unknown) {
  return String(value || '').trim().slice(0, 80);
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ categories: [] });
    const rows = await session.sql`
      SELECT id, name FROM link_categories WHERE owner_id = ${session.userId} ORDER BY name
    `;
    return NextResponse.json({ categories: rows });
  } catch (err) {
    fail('links_categories', err);
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const name = clean(body.name) || 'Uncategorized';
    if (!session.sql) return NextResponse.json({ name, saved: false });
    await session.sql`
      INSERT INTO link_categories (owner_id, name, subs)
      VALUES (${session.userId}, ${name}, '{}')
      ON CONFLICT (owner_id, name) DO NOTHING
    `;
    return NextResponse.json({ name });
  } catch (err) {
    fail('links_categories', err);
    return NextResponse.json({ saved: false });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const url = new URL(req.url);
    const name = clean(body.name || url.searchParams.get('name'));
    if (!session.sql || !name || name === 'Uncategorized') return NextResponse.json({ ok: false });
    await session.sql`
      UPDATE links SET category = 'Uncategorized', sub = '', leaf = ''
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
    fail('links_categories', err);
    return NextResponse.json({ ok: false });
  }
}
