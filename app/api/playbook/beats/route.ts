import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { addBeat, listBeats, markBeat, patchBeat, readCadence } from '@/lib/playbook-beats';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

async function gate() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { error: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId };
}

/** P13 longer beats with real countdowns. */
export async function GET() {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    return NextResponse.json({ beats: await listBeats(g.sql, g.ownerId) });
  } catch (err) {
    fail('playbook_beats_get', err);
    return NextResponse.json({ error: 'Beats could not be read.' }, { status: 500 });
  }
}

/**
 * Create: { name, cadence: { kind: 'days'|'weekly'|'monthly'|'quarterly', every?, anchor: 'YYYY-MM-DD' }, sub?, color? }.
 * Done: { id, action: 'done', day } (or 'undone' to undo).
 */
export async function POST(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = String(body?.action || '');
    if (action === 'done' || action === 'undone') {
      const id = String(body?.id || '');
      if (!ID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const ok = await markBeat(g.sql, g.ownerId, id, String(body?.day || ''), action === 'undone');
      if (!ok) return NextResponse.json({ error: 'That beat could not be marked.' }, { status: 400 });
      return NextResponse.json({ ok: true, beats: await listBeats(g.sql, g.ownerId) });
    }
    const cadence = readCadence(body?.cadence);
    if (!cadence) return NextResponse.json({ error: 'Pick how often (every N days, weekly, monthly or quarterly) and a start date.' }, { status: 400 });
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name the beat.' }, { status: 400 });
    const id = await addBeat(g.sql, g.ownerId, { name, cadence, sub: String(body?.sub || ''), color: String(body?.color || '') });
    if (!id) return NextResponse.json({ error: 'A daily rhythm already has that name.' }, { status: 409 });
    return NextResponse.json({ ok: true, id, beats: await listBeats(g.sql, g.ownerId) });
  } catch (err) {
    fail('playbook_beats_post', err);
    return NextResponse.json({ error: 'That beat could not be saved.' }, { status: 500 });
  }
}

/** Edit: { id, name?, cadence?, sub?, color?, active? }. active:false is the soft remove; active:true undoes it. */
export async function PATCH(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = String(body?.id || '');
    if (!ID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    let cadence;
    if (body && 'cadence' in body) {
      cadence = readCadence(body.cadence);
      if (!cadence) return NextResponse.json({ error: 'That cadence is not valid.' }, { status: 400 });
    }
    const ok = await patchBeat(g.sql, g.ownerId, id, {
      name: body?.name != null ? String(body.name) : undefined,
      cadence: cadence || undefined,
      sub: body?.sub != null ? String(body.sub) : undefined,
      color: body?.color != null ? String(body.color) : undefined,
      active: typeof body?.active === 'boolean' ? body.active : undefined,
    });
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, beats: await listBeats(g.sql, g.ownerId) });
  } catch (err) {
    fail('playbook_beats_patch', err);
    return NextResponse.json({ error: 'That beat could not be saved.' }, { status: 500 });
  }
}
