import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { saveStory } from '@/lib/news-collections';
import { newsOwner } from '@/lib/news-gate';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** POST {title, url, source?, image?, category?, why?, publishedAt?, newsId?, note?, collections:[id], mode?:'merge'|'set'} */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    const gate = newsOwner(session, session ? await sessionOwner(session) : null);
    if ('res' in gate) return gate.res;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
    const out = await saveStory(gate.sql, gate.ownerId, body);
    if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
  } catch (err) {
    fail('news_saved_post', err);
    return NextResponse.json({ error: 'Could not save the story' }, { status: 500 });
  }
}
