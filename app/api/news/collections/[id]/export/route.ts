import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { exportCollection } from '@/lib/news-collections';
import { newsOwner } from '@/lib/news-gate';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET: the collection as a Markdown document, served as a download. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const doc = await exportCollection(gate.sql, gate.ownerId, String(params.id || ''));
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const file = (doc.name.replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-') || 'collection') + '.md';
    return new NextResponse(doc.body, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${file}"`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    fail('news_collection_export', err);
    return NextResponse.json({ error: 'Could not export the collection' }, { status: 500 });
  }
}
