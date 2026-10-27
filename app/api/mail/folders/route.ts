import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function ensure(sql: NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']) {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS email_box_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    name text NOT NULL,
    position int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE email_boxes ADD COLUMN IF NOT EXISTS folder_id uuid`;
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ folders: [] });
    await ensure(session.sql);
    const rows = await session.sql`
      SELECT id, name, position FROM email_box_folders
      WHERE owner_id = ${ownerId}
      ORDER BY position ASC, created_at ASC
      LIMIT 9
    `;
    return NextResponse.json({ folders: rows || [] });
  } catch (err) {
    fail('mail_folders', err);
    return NextResponse.json({ folders: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false }, { status: 400 });
    await ensure(session.sql);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name || /^main$/i.test(name)) return NextResponse.json({ error: 'Need a folder name.' }, { status: 400 });
    const n = await session.sql`SELECT count(*)::int AS n FROM email_box_folders WHERE owner_id = ${ownerId}`;
    if (Number(n[0]?.n || 0) >= 9) return NextResponse.json({ error: 'Nine folders is the cap.' }, { status: 400 });
    const rows = await session.sql`
      INSERT INTO email_box_folders (owner_id, name, position)
      VALUES (${ownerId}, ${name}, ${(Number(n[0]?.n || 0) + 1)})
      RETURNING id, name, position
    `;
    return NextResponse.json({ ok: true, folder: rows[0] });
  } catch (err) {
    fail('mail_folders_post', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
