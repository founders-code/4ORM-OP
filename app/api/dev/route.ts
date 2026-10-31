import { NextResponse } from 'next/server';
import { addItem, importPlan, patchItem, readDev, syncDevOut } from '@/lib/dev';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

async function gate() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { error: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId, userId: session.userId };
}

/** Development: projects, gates, deliverables and the change log. Chad only. */
export async function GET() {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    await syncDevOut(g.sql, g.ownerId, g.userId).catch((err) => fail('dev_sync', err));
    return NextResponse.json(await readDev(g.sql, g.ownerId));
  } catch (err) {
    fail('dev_get', err);
    return NextResponse.json({ error: 'Development could not be read.' }, { status: 500 });
  }
}

/** { action: 'import', plan } brings in a plan file; { action: 'add', projectId, title, ... } adds a deliverable. */
export async function POST(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Nothing was sent.' }, { status: 400 });
    if (body.action === 'import') {
      const plan = body.plan && typeof body.plan === 'object' ? (body.plan as Record<string, unknown>) : null;
      if (!plan) return NextResponse.json({ error: 'That is not a plan file.' }, { status: 400 });
      const out = await importPlan(g.sql, g.ownerId, plan).catch((err: Error) => ({ error: err.message }));
      if ('error' in out) return NextResponse.json({ error: out.error }, { status: 400 });
      const synced = await syncDevOut(g.sql, g.ownerId, g.userId, true).catch((err) => { fail('dev_sync', err); return null; });
      return NextResponse.json({ ok: true, ...out, synced, ...(await readDev(g.sql, g.ownerId)) });
    }
    if (body.action === 'add') {
      const pid = String(body.projectId || '');
      if (!ID.test(pid)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const id = await addItem(g.sql, g.ownerId, pid, body).catch((err: Error) => { throw Object.assign(err, { soft: true }); });
      if (!id) return NextResponse.json({ error: 'That code is already in this project.' }, { status: 409 });
      return NextResponse.json({ ok: true, id, ...(await readDev(g.sql, g.ownerId)) });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if ((err as { soft?: boolean }).soft) return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    fail('dev_post', err);
    return NextResponse.json({ error: 'That could not be saved.' }, { status: 500 });
  }
}

/** { id, stage?, check?, note?, archived? } on one gate or deliverable. */
export async function PATCH(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = String(body?.id || '');
    if (!ID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ok = await patchItem(g.sql, g.ownerId, id, body || {});
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (body && (body.check != null || body.stage != null || body.archived != null)) await syncDevOut(g.sql, g.ownerId, g.userId, true).catch((err) => fail('dev_sync', err));
    return NextResponse.json({ ok: true, ...(await readDev(g.sql, g.ownerId)) });
  } catch (err) {
    fail('dev_patch', err);
    return NextResponse.json({ error: 'That could not be saved.' }, { status: 500 });
  }
}
