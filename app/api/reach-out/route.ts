import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { addReach, createList, softDeleteList, restoreList } from '@/lib/reach';
import { buildCallLists, flattenPeople } from '@/lib/reach-lists';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ people: [], lists: [] });
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
