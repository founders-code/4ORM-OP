import { NextResponse } from 'next/server';
import { applyChadAccountFix, chadDoneCounts, listDeletedBoxes } from '@/lib/chad-account-fix';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';
import { isRoomEmail, openBoard, roomOwner, sessionEmail } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function chadOnly() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isRoomEmail(await sessionEmail(session))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const sql = session.sql || (await getSql());
  if (!sql) return { error: NextResponse.json({ error: 'Unavailable' }, { status: 400 }) };
  const room = await roomOwner(sql).catch(() => '');
  const owners = [...new Set([session.userId, room].filter(Boolean).map(String))];
  return { sql, owners, userId: session.userId };
}

export async function GET() {
  try {
    const gate = await chadOnly();
    if ('error' in gate && gate.error) return gate.error;
    const { sql, owners } = gate as { sql: NonNullable<Awaited<ReturnType<typeof getSql>>>; owners: string[] };
    const boxes = [];
    for (const ownerId of owners) {
      const deleted = await listDeletedBoxes(sql, ownerId);
      const allBoxes = await sql`
        SELECT key, name, deleted_at, created_at
        FROM email_boxes WHERE owner_id = ${ownerId}
        ORDER BY deleted_at NULLS FIRST, name
      `;
      const live = await sql`
        SELECT key, name, deleted_at,
          (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = email_boxes.owner_id AND a.box_key = email_boxes.key AND a.deleted_at IS NULL) AS addr_n,
          (SELECT count(*)::int FROM email_box_tags t WHERE t.owner_id = email_boxes.owner_id AND t.box_key = email_boxes.key AND t.deleted_at IS NULL) AS tag_n
        FROM email_boxes
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL
        ORDER BY name
      `;
      const counts = await chadDoneCounts(sql, ownerId);
      boxes.push({ ownerId, deleted, live, allBoxes, done: counts });
    }
    return NextResponse.json({ ok: true, readOnly: true, owners, boxes });
  } catch (err) {
    fail('chad_account_get', err);
    return NextResponse.json({ error: 'Could not list Chad account rows.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await chadOnly();
    if ('error' in gate && gate.error) return gate.error;
    const body = (await req.json().catch(() => null)) as { apply?: boolean } | null;
    if (!body?.apply) return NextResponse.json({ error: 'Send { apply: true }.' }, { status: 400 });
    const { sql, owners } = gate as { sql: NonNullable<Awaited<ReturnType<typeof getSql>>>; owners: string[] };
    const result = await applyChadAccountFix(sql, owners);
    return NextResponse.json({ ok: true, applied: true, ...result });
  } catch (err) {
    fail('chad_account_apply', err);
    return NextResponse.json({ error: 'Could not apply Chad account restore.' }, { status: 500 });
  }
}
