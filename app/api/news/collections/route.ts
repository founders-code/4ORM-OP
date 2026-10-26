import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { createCollection, readCollections } from '@/lib/news-collections';
import { newsOwner } from '@/lib/news-gate';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET: live collections (defaults seeded once) with counts, plus every live saved story. */
export async function GET() {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    return NextResponse.json(await readCollections(gate.sql, gate.ownerId));
  } catch (err) {
    fail('news_collections_get', err);
    return NextResponse.json({ error: 'Could not load collections' }, { status: 500 });
  }
}

/** POST {name, description?}: new collection. */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
    const out = await createCollection(gate.sql, gate.ownerId, body);
    if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    fail('news_collections_post', err);
    return NextResponse.json({ error: 'Could not create the collection' }, { status: 500 });
  }
}
