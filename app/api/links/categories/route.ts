import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { softDeleteCategory } from '@/lib/link-cats';

export const dynamic = 'force-dynamic';

function clean(value: unknown) {
  return String(value || '').trim().slice(0, 80);
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ categories: [] });
    const rows = await session.sql`
      SELECT id, name FROM link_categories
      WHERE owner_id = ${session.userId} AND COALESCE(to_jsonb(link_categories) ->> 'deleted_at', '') = ''
      ORDER BY name
    `;
    return NextResponse.json({ categories: rows });
  } catch (err) {
    fail('links_categories', err);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const name = clean(body.name) || 'Uncategorized';
    if (!session.sql) return NextResponse.json({ name, saved: false }, { status: 503 });
    await session.sql`
      INSERT INTO link_categories (owner_id, name, subs)
      VALUES (${session.userId}, ${name}, '{}')
      ON CONFLICT (owner_id, name) DO UPDATE SET deleted_at = NULL, undo = NULL, subs = '{}', nest = NULL
        WHERE link_categories.deleted_at IS NOT NULL
    `;
    return NextResponse.json({ name });
  } catch (err) {
    fail('links_categories', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const url = new URL(req.url);
    const name = clean(body.name || url.searchParams.get('name'));
    if (!session.sql || !name || name === 'Uncategorized') return NextResponse.json({ ok: false, error: 'That category cannot be removed.' }, { status: 400 });
    // Soft delete with an undo snapshot (lib/link-cats.ts); links move to Uncategorized and come back on restore.
    const removed = await softDeleteCategory(session.sql, session.userId, name);
    if (!removed.ok) return NextResponse.json({ ok: false, error: removed.error }, { status: removed.status });
    return NextResponse.json({ ok: true, moved: 'Uncategorized', links: removed.moved });
  } catch (err) {
    fail('links_categories', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
