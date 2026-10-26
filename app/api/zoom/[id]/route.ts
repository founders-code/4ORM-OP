import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

/** Accepts an array or a delimited string (newline for notes, comma for attendees). */
function listOf(value: unknown, split: RegExp, max: number) {
  const raw = Array.isArray(value) ? value.map((v) => String(v ?? '')) : String(value ?? '').split(split);
  return raw.map((line) => line.trim()).filter(Boolean).slice(0, max);
}

/**
 * Partial update: only fields present in the body change.
 * Body: { title?, others?: string | string[], attendees?: string | string[], archived?: boolean }
 * archived:true soft-deletes (deleted_at = now()); archived:false restores.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not update that note.' }, { status: 400 });
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const setTitle = has('title');
    const title = String(body.title ?? '').trim().slice(0, 180) || 'Untitled meeting';
    const setOthers = has('others');
    const others = JSON.stringify(listOf(body.others, /\n/, 40));
    const setAttendees = has('attendees');
    const attendees = JSON.stringify(listOf(body.attendees, /,/, 20));
    const setArchived = has('archived');
    const archived = body.archived === true;
    const rows = await session.sql`
      UPDATE zoom_notes
      SET title = CASE WHEN ${setTitle} THEN ${title} ELSE title END,
          others = CASE WHEN ${setOthers} THEN ${others}::jsonb ELSE others END,
          attendees = CASE WHEN ${setAttendees} THEN ${attendees}::jsonb ELSE attendees END,
          deleted_at = CASE WHEN ${setArchived} THEN (CASE WHEN ${archived} THEN coalesce(deleted_at, now()) ELSE NULL END) ELSE deleted_at END
      WHERE id = ${params.id} AND owner_id = ${session.userId}
      RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('zoom_note', err);
    return NextResponse.json({ error: 'Could not update that note.' }, { status: 500 });
  }
}

/** Soft delete. Restore with PATCH { archived: false }. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not delete that note.' }, { status: 400 });
    await session.sql`
      UPDATE zoom_notes SET deleted_at = now()
      WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('zoom_note', err);
    return NextResponse.json({ error: 'Could not delete that note.' }, { status: 500 });
  }
}
