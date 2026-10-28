import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/* Living plan documents (the 30-day plan first). Plain text with light markdown; every save keeps the old copy. */
async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { err: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  const sql = session.sql;
  await sql`CREATE TABLE IF NOT EXISTS plan_docs (owner_id text NOT NULL, key text NOT NULL, title text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (owner_id, key))`;
  await sql`CREATE TABLE IF NOT EXISTS plan_doc_versions (id bigserial PRIMARY KEY, owner_id text NOT NULL, key text NOT NULL,
    body text NOT NULL, saved_at timestamptz NOT NULL DEFAULT now())`;
  return { sql, ownerId };
}

const keyOf = (v: unknown) => String(v || '30day').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || '30day';

export async function GET(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const key = keyOf(new URL(req.url).searchParams.get('key'));
    const row = (await g.sql`SELECT title, body, updated_at FROM plan_docs WHERE owner_id = ${g.ownerId} AND key = ${key}`)[0];
    return NextResponse.json(row || { title: '', body: '', updated_at: null });
  } catch (err) {
    fail('plan_doc_get', err);
    return NextResponse.json({ error: 'Could not load' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = keyOf(b.key);
    const body = String(b.body || '').slice(0, 200000);
    const title = String(b.title || '').slice(0, 200);
    const old = (await g.sql`SELECT body FROM plan_docs WHERE owner_id = ${g.ownerId} AND key = ${key}`)[0];
    if (old && old.body) await g.sql`INSERT INTO plan_doc_versions (owner_id, key, body) VALUES (${g.ownerId}, ${key}, ${String(old.body)})`;
    await g.sql`INSERT INTO plan_docs (owner_id, key, title, body) VALUES (${g.ownerId}, ${key}, ${title}, ${body})
      ON CONFLICT (owner_id, key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('plan_doc_put', err);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
