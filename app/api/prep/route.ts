import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { prepList, prepPatch, prepUpsert } from '@/lib/prep';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Email Prep: owner-only. Lists, loads and updates prepared outreach. Sends nothing. */
async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { err: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId };
}

export async function GET() {
  try {
    const g = await gate();
    if ('err' in g) return g.err;
    return NextResponse.json({ items: await prepList(g.sql, g.ownerId) });
  } catch (err) {
    fail('prep_get', err);
    return NextResponse.json({ error: 'Could not load Prep.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await gate();
    if ('err' in g) return g.err;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const a = String(body.action || '');
    if (a === 'upsert') return NextResponse.json({ ok: true, ...(await prepUpsert(g.sql, g.ownerId, Array.isArray(body.items) ? body.items : [])) });
    if (a === 'patch') {
      const id = String(body.id || '').replace(/[^a-z0-9_-]/gi, '');
      if (!id) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      await prepPatch(g.sql, g.ownerId, id, (body.patch || {}) as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    fail('prep_post', err);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
}
