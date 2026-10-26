import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { deleteCollection, patchCollection } from '@/lib/news-collections';
import { newsOwner } from '@/lib/news-gate';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** PATCH {name?, description?, usedIn?, archived:false?}: rename, describe, set "Used in", or restore. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
    const out = await patchCollection(gate.sql, gate.ownerId, String(params.id || ''), body);
    if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
  } catch (err) {
    fail('news_collection_patch', err);
    return NextResponse.json({ error: 'Could not save the collection' }, { status: 500 });
  }
}

/** DELETE: soft delete (deleted_at). Restore with PATCH {archived:false}. Saved stories are kept. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const out = await deleteCollection(gate.sql, gate.ownerId, String(params.id || ''));
    if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
  } catch (err) {
    fail('news_collection_delete', err);
    return NextResponse.json({ error: 'Could not delete the collection' }, { status: 500 });
  }
}
