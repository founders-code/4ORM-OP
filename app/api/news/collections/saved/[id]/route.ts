import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { deleteSaved, patchSaved } from '@/lib/news-collections';
import { newsOwner } from '@/lib/news-gate';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** PATCH {note?, usedIn?, collections?, archived:false?} on one saved story. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
    const out = await patchSaved(gate.sql, gate.ownerId, String(params.id || ''), body);
    if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
  } catch (err) {
    fail('news_saved_patch', err);
    return NextResponse.json({ error: 'Could not save that change' }, { status: 500 });
  }
}

/** DELETE: soft delete. Undo with PATCH {archived:false}. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const out = await deleteSaved(gate.sql, gate.ownerId, String(params.id || ''));
    if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
  } catch (err) {
    fail('news_saved_delete', err);
    return NextResponse.json({ error: 'Could not remove the story' }, { status: 500 });
  }
}
