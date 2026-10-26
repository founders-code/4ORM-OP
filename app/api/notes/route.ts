import { NextResponse } from 'next/server';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { allowNoteColor } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

function noteShape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    catId: row.cat_id ? String(row.cat_id) : null,
    title: String(row.title || ''),
    body: String(row.body || ''),
    color: String(row.color || 'yellow'),
    pin: !!row.pinned,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).getTime() : null,
  };
}

async function inbox(sql: NeonQueryFunction<false, false>, userId: string) {
  const found = await sql!`
    SELECT id FROM note_cats
    WHERE owner_id = ${userId} AND parent_id IS NULL AND name = 'Inbox'
    LIMIT 1
  `;
  if (found[0]?.id) return String(found[0].id);
  const made = await sql!`
    INSERT INTO note_cats (owner_id, name, parent_id, depth)
    VALUES (${userId}, 'Inbox', NULL, 0)
    RETURNING id
  `;
  return String(made[0].id);
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ notes: [] });
    const rows = await session.sql`
      SELECT id, cat_id, title, body, color, pinned, updated_at
      FROM notes WHERE owner_id = ${session.userId} AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 400
    `;
    return NextResponse.json({
      notes: (rows as Record<string, unknown>[]).map(noteShape),
    });
  } catch (err) {
    fail('notes_failed', err);
    return NextResponse.json({ notes: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ saved: false });
    const body = await req.json().catch(() => null);
    if (String(body?.kind || '') === 'category') {
      const name = clean(body?.name, 80);
      if (!name) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      const parentId = body?.parentId ? String(body.parentId) : '';
      let depth = 0;
      let parent: string | null = null;
      if (parentId) {
        if (!ID.test(parentId)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
        const rows = await session.sql`
          SELECT depth FROM note_cats WHERE id = ${parentId} AND owner_id = ${session.userId} LIMIT 1
        `;
        if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
        depth = Number(rows[0].depth) + 1;
        if (depth > 2) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
        parent = parentId;
      }
      const made = await session.sql`
        INSERT INTO note_cats (owner_id, name, parent_id, depth)
        VALUES (${session.userId}, ${name}, ${parent}, ${depth})
        RETURNING id, name, parent_id, depth
      `;
      const row = made[0];
      return NextResponse.json({
        id: String(row.id),
        name: String(row.name),
        parentId: row.parent_id ? String(row.parent_id) : null,
        depth: Number(row.depth),
      });
    }
    const title = clean(body?.title, 180);
    const noteBody = clean(body?.body, 4000);
    const color = allowNoteColor(String(body?.color || 'yellow')) || 'yellow';
    if (!title) {
      const rows = await session.sql`
        INSERT INTO sticky_notes (owner_id, body, color, x, y, w, h)
        VALUES (${session.userId}, ${noteBody.slice(0, 2000)}, ${color}, ${Number(body?.x) || 24}, ${Number(body?.y) || 24}, ${Number(body?.w) || 180}, ${Number(body?.h) || 120})
        RETURNING id, body, color, x, y, w, h
      `;
      const row = rows[0] as Record<string, unknown>;
      return NextResponse.json({
        id: String(row.id),
        body: String(row.body || ''),
        color: String(row.color || color),
        x: Number(row.x) || 0,
        y: Number(row.y) || 0,
        w: Number(row.w) || 180,
        h: Number(row.h) || 120,
      });
    }
    let catId = body?.catId ? String(body.catId) : '';
    if (catId) {
      if (!ID.test(catId)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      const cats = await session.sql`
        SELECT id FROM note_cats WHERE id = ${catId} AND owner_id = ${session.userId} LIMIT 1
      `;
      if (!cats.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    } else {
      catId = await inbox(session.sql, session.userId);
    }
    const dup = await session.sql`
      SELECT id, cat_id, title, body, color, updated_at FROM notes
      WHERE owner_id = ${session.userId}
        AND deleted_at IS NULL
        AND lower(trim(title)) = ${title.toLowerCase()}
        AND coalesce(body, '') = ${noteBody}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (dup.length) return NextResponse.json(noteShape(dup[0] as Record<string, unknown>));
    const made = await session.sql`
      INSERT INTO notes (owner_id, cat_id, title, body, color)
      VALUES (${session.userId}, ${catId}, ${title}, ${noteBody}, ${color})
      RETURNING id, cat_id, title, body, color, updated_at
    `;
    return NextResponse.json(noteShape(made[0] as Record<string, unknown>));
  } catch (err) {
    fail('notes_failed', err);
    return NextResponse.json({ saved: false });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    if (!ID.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const title = clean(body?.title, 180);
    const noteBody = clean(body?.body, 4000);
    const color = body?.color == null || body.color === '' ? null : allowNoteColor(String(body.color));
    if (body?.color && !color) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (body?.title != null && !title) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    let catId: string | null = null;
    const setCat = body && Object.prototype.hasOwnProperty.call(body, 'catId');
    if (setCat && body.catId) {
      catId = String(body.catId);
      if (!ID.test(catId)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      const cats = await session.sql`
        SELECT id FROM note_cats WHERE id = ${catId} AND owner_id = ${session.userId} LIMIT 1
      `;
      if (!cats.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    }
    const rows = await session.sql`
      UPDATE notes SET
        title = COALESCE(${title || null}, title),
        body = CASE WHEN ${body && Object.prototype.hasOwnProperty.call(body, 'body')} THEN ${noteBody} ELSE body END,
        color = COALESCE(${color}, color),
        cat_id = CASE WHEN ${setCat} THEN ${catId} ELSE cat_id END,
        updated_at = now()
      WHERE id = ${id} AND owner_id = ${session.userId}
      RETURNING id, cat_id, title, body, color, updated_at
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json(noteShape(rows[0] as Record<string, unknown>));
  } catch {
    fail('notes_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const kind = String(body?.kind || '');
    if (!ID.test(id) || (kind !== 'note' && kind !== 'category')) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    if (kind === 'note') {
      const rows = await session.sql`
        DELETE FROM notes WHERE id = ${id} AND owner_id = ${session.userId} RETURNING id
      `;
      if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
      return NextResponse.json({ id });
    }
    const rows = await session.sql`
      DELETE FROM note_cats WHERE id = ${id} AND owner_id = ${session.userId} RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id });
  } catch {
    fail('notes_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
