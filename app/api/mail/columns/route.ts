import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { ensureMailBoard, listColumns, seedColumns } from '@/lib/mail-board';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const KEY_RE = /^[a-z0-9_]{2,40}$/;

function keyOf(name: string) {
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  return KEY_RE.test(base) ? base : `col_${Date.now().toString(36)}`;
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ columns: [] });
    await ensureMailBoard(session.sql);
    await seedColumns(session.sql, session.userId);
    return NextResponse.json({ columns: await listColumns(session.sql, session.userId) });
  } catch (err) {
    fail('mail_cols', err);
    return NextResponse.json({ columns: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ saved: false });
    await ensureMailBoard(session.sql);
    const action = String(body.action || '');
    if (action === 'create') {
      const name = String(body.name || 'Column').replace(/[\u2013\u2014]/g, '-').trim().slice(0, 40) || 'Column';
      const key = keyOf(name);
      try {
        const rows = await session.sql`SELECT coalesce(max(position), -1) + 1 AS n FROM email_columns WHERE owner_id = ${session.userId} AND deleted_at IS NULL`;
        const pos = Number((rows[0] as { n?: number } | undefined)?.n) || 0;
        await session.sql`
          INSERT INTO email_columns (owner_id, key, name, position, width)
          VALUES (${session.userId}, ${key}, ${name}, ${pos}, 280)
          ON CONFLICT (owner_id, key) DO UPDATE SET name = EXCLUDED.name, deleted_at = NULL
        `;
      } catch (err) {
        fail('mail_col_create', err);
        return NextResponse.json({ saved: false });
      }
    }
    if (action === 'rename') {
      const key = String(body.key || '');
      const name = String(body.name || '').replace(/[\u2013\u2014]/g, '-').trim().slice(0, 40);
      if (KEY_RE.test(key) && name) {
        try {
          await session.sql`UPDATE email_columns SET name = ${name} WHERE owner_id = ${session.userId} AND key = ${key}`;
        } catch (err) {
          fail('mail_col_rename', err);
        }
      }
    }
    if (action === 'delete') {
      const key = String(body.key || '');
      if (KEY_RE.test(key) && key !== 'needs_now' && key !== 'quiet') {
        try {
          await session.sql`UPDATE email_columns SET deleted_at = now() WHERE owner_id = ${session.userId} AND key = ${key} AND deleted_at IS NULL`;
          await session.sql`UPDATE email_file SET column_key = ${'prospects'} WHERE owner_id = ${session.userId} AND column_key = ${key}`;
        } catch (err) {
          fail('mail_col_del', err);
        }
      }
    }
    if (action === 'reorder' && Array.isArray(body.keys)) {
      const keys = body.keys.map((k) => String(k)).filter((k) => KEY_RE.test(k)).slice(0, 24);
      try {
        for (let i = 0; i < keys.length; i += 1) {
          await session.sql`UPDATE email_columns SET position = ${i} WHERE owner_id = ${session.userId} AND key = ${keys[i]}`;
        }
      } catch (err) {
        fail('mail_col_order', err);
      }
    }
    if (action === 'width') {
      const key = String(body.key || '');
      const width = Math.max(200, Math.min(560, Number(body.width) || 280));
      if (KEY_RE.test(key)) {
        try {
          await session.sql`UPDATE email_columns SET width = ${width} WHERE owner_id = ${session.userId} AND key = ${key}`;
        } catch (err) {
          fail('mail_col_width', err);
        }
      }
    }
    if (action === 'collapse') {
      const key = String(body.key || '');
      if (KEY_RE.test(key)) {
        try {
          await session.sql`UPDATE email_columns SET collapsed = ${!!body.collapsed} WHERE owner_id = ${session.userId} AND key = ${key}`;
        } catch (err) {
          fail('mail_col_collapse', err);
        }
      }
    }
    return NextResponse.json({ saved: true, columns: await listColumns(session.sql, session.userId) });
  } catch (err) {
    fail('mail_cols_write', err);
    return NextResponse.json({ saved: false });
  }
}
