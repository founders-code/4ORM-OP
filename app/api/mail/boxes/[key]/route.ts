import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: { key: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false }, { status: 400 });
    const key = String(ctx.params.key || '').slice(0, 80);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await session.sql`ALTER TABLE email_boxes ADD COLUMN IF NOT EXISTS folder_id uuid`;
    let folderId: string | null = null;
    if (body.folder_id === null || body.folder_id === '') folderId = null;
    else if (body.folder_id) folderId = String(body.folder_id);
    const extra = body.n || body.name || body.o || body.addrs
      ? {
          n: String(body.n || body.name || ''),
          o: String(body.o || body.org || ''),
          c: String(body.c || body.color || '#2e6bf2'),
        }
      : null;
    const live = await session.sql`SELECT key FROM email_boxes WHERE owner_id = ${ownerId} AND key = ${key} AND deleted_at IS NULL LIMIT 1`;
    if (!live.length && extra && extra.n) {
      await session.sql`
        INSERT INTO email_boxes (owner_id, key, name, org, color, folder_id, extra)
        VALUES (${ownerId}, ${key}, ${extra.n.slice(0, 80)}, ${extra.o.slice(0, 120)}, ${extra.c.slice(0, 16)}, ${folderId}, ${JSON.stringify(body)}::jsonb)
        ON CONFLICT (owner_id, key) DO UPDATE SET folder_id = EXCLUDED.folder_id, deleted_at = NULL, name = EXCLUDED.name
      `;
    } else {
      await session.sql`UPDATE email_boxes SET folder_id = ${folderId} WHERE owner_id = ${ownerId} AND key = ${key}`;
    }
    if (Array.isArray(body.addrs)) {
      for (const email of body.addrs.map((e) => String(e || '').toLowerCase()).filter(Boolean)) {
        await session.sql`
          INSERT INTO email_box_addresses (owner_id, box_key, email)
          VALUES (${ownerId}, ${key}, ${email})
          ON CONFLICT (owner_id, box_key, email) DO UPDATE SET deleted_at = NULL
        `;
      }
    }
    return NextResponse.json({ ok: true, folder_id: folderId });
  } catch (err) {
    fail('mail_box_patch', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
