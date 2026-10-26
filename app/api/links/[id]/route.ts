import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;
/**
 * Legacy client sentinel for "archive this link". The client no longer sends it (it sends archived:true);
 * this only protects tabs still running the old script. Never stored as the note. Safe to remove after one deploy.
 */
const ARCHIVED_SENTINEL = '__archived__';

function cleanName(value: unknown) {
  return String(value ?? '').trim().slice(0, 80);
}

/**
 * Partial update: only fields present in the body change.
 * Body: { title?, note?, category?, sub?, leaf?, archived?: boolean }
 * archived:true soft-deletes (deleted_at = now()); archived:false restores.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const legacyArchive = has('note') && String(body.note) === ARCHIVED_SENTINEL;
    const setNote = has('note') && !legacyArchive;
    const note = setNote ? String(body.note ?? '').slice(0, 2000) : '';
    const title = cleanName(body.title);
    const setTitle = has('title') && !!title;
    const setCategory = has('category');
    const category = cleanName(body.category) || 'Uncategorized';
    const setSub = has('sub');
    const sub = cleanName(body.sub);
    const setLeaf = has('leaf');
    const leaf = cleanName(body.leaf);
    const setArchived = has('archived') || legacyArchive;
    const archived = legacyArchive || body.archived === true;
    const rows = await session.sql`
      UPDATE links
      SET note = CASE WHEN ${setNote} THEN ${note} ELSE note END,
          title = CASE WHEN ${setTitle} THEN ${title} ELSE title END,
          category = CASE WHEN ${setCategory} THEN ${category} ELSE category END,
          sub = CASE WHEN ${setSub} THEN ${sub} ELSE sub END,
          leaf = CASE WHEN ${setLeaf} THEN ${leaf} ELSE leaf END,
          deleted_at = CASE WHEN ${setArchived} THEN (CASE WHEN ${archived} THEN coalesce(deleted_at, now()) ELSE NULL END) ELSE deleted_at END
      WHERE id = ${params.id} AND owner_id = ${session.userId}
      RETURNING id, title, url, category, sub, leaf, note, deleted_at
    `;
    if (!rows.length) return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
    const row = rows[0] as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      id: String(row.id),
      title: String(row.title || ''),
      url: String(row.url || ''),
      cat: String(row.category || ''),
      sub: String(row.sub || ''),
      leaf: String(row.leaf || ''),
      note: String(row.note || ''),
      archived: !!row.deleted_at,
    });
  } catch (err) {
    fail('links_failed', err);
    return NextResponse.json({ error: 'Could not update that link.' }, { status: 500 });
  }
}

/** Soft delete. Restore with PATCH { archived: false }. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await session.sql`
      UPDATE links SET deleted_at = now()
      WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('links_failed', err);
    return NextResponse.json({ error: 'Could not delete that link.' }, { status: 500 });
  }
}
