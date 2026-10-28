import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { addReach, createList, softDeleteList, restoreList, uploadList, personNotes } from '@/lib/reach';
import { buildCallLists, flattenPeople } from '@/lib/reach-lists';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ people: [], lists: [] });
    const url = new URL(req.url);
    const notesFor = url.searchParams.get('notes');
    if (notesFor) {
      const packed = await personNotes(session.sql, ownerId, session.userId, notesFor);
      return NextResponse.json(packed);
    }
    const lists = await buildCallLists(session.sql, ownerId, session.userId);
    const people = flattenPeople(lists);
    return NextResponse.json({ people, lists });
  } catch (err) {
    fail('reach_list', err);
    return NextResponse.json({ people: [], lists: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ name: String(body.name || 'Person'), saved: false }, { status: 503 });
    if (body.kind === 'list' || body.action === 'create-list') {
      const list = await createList(session.sql, ownerId, String(body.name || ''));
      return NextResponse.json(list);
    }
    if (body.action === 'upload-list') {
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      if (!rows.length) return NextResponse.json({ error: 'No rows to upload.' }, { status: 400 });
      const list = await uploadList(
        session.sql,
        ownerId,
        String(body.name || ''),
        rows.map((r) => ({
          name: String(r.name || ''),
          company: String(r.company || ''),
          phone: String(r.phone || ''),
          email: String(r.email || ''),
          notes: String(r.notes || ''),
          city: String(r.city || ''),
        })),
      );
      return NextResponse.json({ ok: true, ...list, undo: true });
    }
    if (body.action === 'delete-list') {
      const removed = await softDeleteList(session.sql, ownerId, String(body.id || ''));
      if (!removed) return NextResponse.json({ saved: false }, { status: 404 });
      return NextResponse.json({ ok: true, ...removed, undo: true });
    }
    if (body.action === 'restore-list') {
      const restored = await restoreList(session.sql, ownerId, String(body.id || ''));
      if (!restored) return NextResponse.json({ saved: false }, { status: 404 });
      return NextResponse.json({ ok: true, ...restored });
    }
    const person = await addReach(session.sql, ownerId, body);
    if (!person) return NextResponse.json({ name: String(body.name || 'Person'), saved: false }, { status: 400 });
    return NextResponse.json(person);
  } catch (err) {
    fail('reach_add', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
