import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Sql = NonNullable<NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']>;

async function ensureTable(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS nav_prefs (
      owner_id text PRIMARY KEY,
      order_json jsonb,
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`ALTER TABLE nav_prefs ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`;
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ order: null });
    await ensureTable(session.sql);
    const rows = await session.sql`SELECT order_json, hidden FROM nav_prefs WHERE owner_id = ${session.userId} LIMIT 1`;
    return NextResponse.json({ order: rows[0]?.order_json ?? null, hidden: !!rows[0]?.hidden });
  } catch {
    fail('nav_prefs_get');
    return NextResponse.json({ order: null }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = await req.json().catch(() => null);
    const order = Array.isArray(body?.order) ? body.order.map((x: unknown) => String(x || '')).filter(Boolean) : null;
    const hidden = typeof body?.hidden === 'boolean' ? body.hidden : null;
    if (!order && hidden == null) return NextResponse.json({ saved: false }, { status: 400 });
    await ensureTable(session.sql);
    const cur = await session.sql`SELECT order_json, hidden FROM nav_prefs WHERE owner_id = ${session.userId} LIMIT 1`;
    const nextOrder = order || cur[0]?.order_json || [];
    const nextHidden = hidden == null ? !!cur[0]?.hidden : hidden;
    await session.sql`
      INSERT INTO nav_prefs (owner_id, order_json, hidden, updated_at)
      VALUES (${session.userId}, ${JSON.stringify(nextOrder)}::jsonb, ${nextHidden}, now())
      ON CONFLICT (owner_id) DO UPDATE SET
        order_json = EXCLUDED.order_json,
        hidden = EXCLUDED.hidden,
        updated_at = now()
    `;
    return NextResponse.json({ saved: true, order: nextOrder, hidden: nextHidden });
  } catch {
    fail('nav_prefs_put');
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
