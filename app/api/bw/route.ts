import { NextResponse } from 'next/server';
import { bwAddContact, bwAddFile, bwCancel, bwDeleteFile, bwDeleteList, bwDeleteSpace, bwHistory, bwImport, bwPatchContact, bwQueue, bwSaveList, bwSaveSpace, bwSettings, bwState, bwTest } from '@/lib/bw';
import { withCreds } from '@/lib/creds';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bruce's workspace (review build): contacts, lists and group email. Owner-only until it gets its own sign-in. */
async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { err: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId, userId: session.userId };
}

export async function GET(req: Request) {
  try {
    const g = await gate();
    if ('err' in g) return g.err;
    const hist = new URL(req.url).searchParams.get('history') || '';
    if (hist) {
      if (!/^[0-9a-f-]{36}$/i.test(hist)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      return NextResponse.json({ history: await bwHistory(g.sql, g.ownerId, hist) });
    }
    return NextResponse.json(await bwState(g.sql, g.ownerId));
  } catch (err) {
    fail('bw_get', err);
    return NextResponse.json({ error: 'Could not load.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await gate();
    if ('err' in g) return g.err;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const a = String(body.action || '');
    if (a === 'import') return NextResponse.json({ ok: true, ...(await bwImport(g.sql, g.ownerId, Array.isArray(body.rows) ? body.rows : [])) });
    if (a === 'contact') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      await bwPatchContact(g.sql, g.ownerId, id, (body.patch || {}) as Record<string, unknown>);
      return NextResponse.json({ ok: true });
    }
    if (a === 'list-save') return NextResponse.json({ ok: true, list: await bwSaveList(g.sql, g.ownerId, { id: String(body.id || ''), name: String(body.name || ''), ids: Array.isArray(body.ids) ? (body.ids as string[]) : [] }) });
    if (a === 'list-delete' || a === 'list-restore') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      await bwDeleteList(g.sql, g.ownerId, id, a === 'list-restore');
      return NextResponse.json({ ok: true });
    }
    const uuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v || ''));
    if (a === 'add-contact') return NextResponse.json({ ok: true, ...(await bwAddContact(g.sql, g.ownerId, (body.contact || {}) as Record<string, unknown>)) });
    if (a === 'space-save') return NextResponse.json({ ok: true, ...(await bwSaveSpace(g.sql, g.ownerId, (body.space || {}) as Record<string, unknown>)) });
    if (a === 'space-delete' || a === 'space-restore') {
      if (!uuid(body.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      await bwDeleteSpace(g.sql, g.ownerId, String(body.id), a === 'space-restore');
      return NextResponse.json({ ok: true });
    }
    if (a === 'file-add') {
      if (!uuid(body.spaceId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      const out = await bwAddFile(g.sql, g.ownerId, { spaceId: String(body.spaceId), name: String(body.name || ''), mime: String(body.mime || ''), b64: String(body.b64 || '') });
      return NextResponse.json(out, { status: out.ok ? 200 : 400 });
    }
    if (a === 'file-delete' || a === 'file-restore') {
      if (!uuid(body.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      await bwDeleteFile(g.sql, g.ownerId, String(body.id), a === 'file-restore');
      return NextResponse.json({ ok: true });
    }
    if (a === 'settings') return NextResponse.json({ ok: true, settings: await bwSettings(g.sql, g.ownerId, (body.settings || {}) as Record<string, unknown>) });
    if (a === 'test') {
      if (!(await takeRateLimit(g.sql, 'bw_test', g.ownerId, 20, 3600))) return NextResponse.json({ ok: false, note: 'Too many tests this hour.' }, { status: 429 });
      const creds = await loadCredsFor(g.userId);
      const out = await withCreds(creds, () => bwTest(g.sql, g.ownerId, { listId: String(body.listId || ''), subject: String(body.subject || ''), body: String(body.body || ''), spaceId: String(body.spaceId || '') }));
      return NextResponse.json(out, { status: out.ok ? 200 : 400 });
    }
    if (a === 'send') {
      const id = String(body.listId || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, note: 'Pick a list.' }, { status: 400 });
      const out = await bwQueue(g.sql, g.ownerId, { listId: id, subject: String(body.subject || ''), body: String(body.body || ''), spaceId: String(body.spaceId || '') });
      return NextResponse.json(out, { status: out.ok ? 200 : 400 });
    }
    if (a === 'cancel') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
      await bwCancel(g.sql, g.ownerId, id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    fail('bw_post', err);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
}
