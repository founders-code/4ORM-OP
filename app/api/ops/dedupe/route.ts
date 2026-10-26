import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Sql = NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql'];

async function logDupes(sql: NonNullable<Sql>, ownerId: string, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await sql`
    INSERT INTO change_log (owner_id, kind, payload)
    VALUES (${ownerId}, ${'dedupe:' + table}, ${JSON.stringify({ table, ids: rows.map((r) => r.id), rows })}::jsonb)
  `;
}

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await currentUser();
    if (user?.publicMetadata?.test !== true) return NextResponse.json({ error: 'Test users only.' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const sql = session.sql;
    const ownerId = session.userId;
    const counts: Record<string, number> = {};

    const itemDupes = await sql`
      UPDATE items SET status = 'dropped', updated_at = now()
      WHERE owner_id = ${ownerId} AND status <> 'dropped' AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY lower(trim(title)) ORDER BY created_at ASC, id ASC) AS rn
          FROM items WHERE owner_id = ${ownerId} AND status <> 'dropped'
        ) t WHERE rn > 1
      )
      RETURNING id, title
    `;
    counts.items = itemDupes.length;
    await logDupes(sql, ownerId, 'items', itemDupes as Record<string, unknown>[]);

    const noteDupes = await sql`
      DELETE FROM notes WHERE owner_id = ${ownerId} AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY lower(trim(title)), md5(coalesce(body, ''))
            ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM notes WHERE owner_id = ${ownerId}
        ) t WHERE rn > 1
      )
      RETURNING id, title
    `;
    counts.notes = noteDupes.length;
    await logDupes(sql, ownerId, 'notes', noteDupes as Record<string, unknown>[]);

    const linkDupes = await sql`
      DELETE FROM links WHERE owner_id = ${ownerId} AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY lower(trim(url))
            ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM links WHERE owner_id = ${ownerId}
        ) t WHERE rn > 1
      )
      RETURNING id, url, title
    `;
    counts.links = linkDupes.length;
    await logDupes(sql, ownerId, 'links', linkDupes as Record<string, unknown>[]);

    const contactDupes = await sql`
      DELETE FROM contacts WHERE owner_id = ${ownerId} AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY lower(trim(coalesce(nullif(email, ''), id::text)))
            ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM contacts WHERE owner_id = ${ownerId} AND coalesce(email, '') <> ''
        ) t WHERE rn > 1
      )
      RETURNING id, email, name
    `;
    counts.contacts = contactDupes.length;
    await logDupes(sql, ownerId, 'contacts', contactDupes as Record<string, unknown>[]);

    const spaceDupes = await sql`
      DELETE FROM packages WHERE owner_id = ${ownerId} AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY lower(trim(name))
            ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM packages WHERE owner_id = ${ownerId}
        ) t WHERE rn > 1
      )
      RETURNING id, name
    `;
    counts.spaces = spaceDupes.length;
    await logDupes(sql, ownerId, 'packages', spaceDupes as Record<string, unknown>[]);

    const docDupes = await sql`
      DELETE FROM documents WHERE owner_id = ${ownerId} AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY coalesce(nullif(drive_file_id, ''), id::text)
            ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM documents WHERE owner_id = ${ownerId} AND coalesce(drive_file_id, '') <> ''
        ) t WHERE rn > 1
      )
      RETURNING id, name, drive_file_id
    `;
    counts.documents = docDupes.length;
    await logDupes(sql, ownerId, 'documents', docDupes as Record<string, unknown>[]);

    let meeting = 0;
    try {
      const meetingDupes = await sql`
        UPDATE meeting_actions SET status = 'handled'
        WHERE owner_id = ${ownerId} AND status = 'open' AND id IN (
          SELECT id FROM (
            SELECT id, row_number() OVER (
              PARTITION BY lower(trim(text))
              ORDER BY created_at ASC, id ASC
            ) AS rn
            FROM meeting_actions WHERE owner_id = ${ownerId} AND status = 'open'
          ) t WHERE rn > 1
        )
        RETURNING id, text
      `;
      meeting = meetingDupes.length;
      await logDupes(sql, ownerId, 'meeting_actions', meetingDupes as Record<string, unknown>[]);
    } catch (err) {
      fail('dedupe_meeting', err);
    }
    counts.meeting_actions = meeting;

    const boxDupes = await sql`
      DELETE FROM email_boxes WHERE owner_id = ${ownerId} AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY lower(trim(name))
            ORDER BY created_at ASC, id ASC
          ) AS rn
          FROM email_boxes WHERE owner_id = ${ownerId}
        ) t WHERE rn > 1
      )
      RETURNING id, name, key
    `;
    counts.email_boxes = boxDupes.length;
    await logDupes(sql, ownerId, 'email_boxes', boxDupes as Record<string, unknown>[]);

    return NextResponse.json({ ok: true, owner: 'session', counts });
  } catch (err) {
    fail('dedupe', err);
    return NextResponse.json({ error: 'Could not sweep duplicates.' }, { status: 400 });
  }
}
