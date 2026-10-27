import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function ensurePrefs(sql: NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']) {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS owner_settings (owner_id text PRIMARY KEY)`;
  await sql`ALTER TABLE owner_settings ADD COLUMN IF NOT EXISTS prefs jsonb NOT NULL DEFAULT '{}'::jsonb`;
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ prefs: {} });
    await ensurePrefs(session.sql);
    const rows = await session.sql`SELECT prefs FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
    const prefs = (rows[0] as { prefs?: Record<string, unknown> } | undefined)?.prefs || {};
    return NextResponse.json({ prefs });
  } catch (err) {
    fail('prefs_get', err);
    return NextResponse.json({ prefs: {} });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    await ensurePrefs(session.sql);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.compose_width != null) {
      const w = Math.round(Number(body.compose_width));
      if (Number.isFinite(w)) patch.compose_width = Math.max(520, Math.min(2400, w));
    }
    if (body.rec_source === 'mic' || body.rec_source === 'both') patch.rec_source = body.rec_source;
    const rows = await session.sql`SELECT prefs FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
    const cur = ((rows[0] as { prefs?: Record<string, unknown> } | undefined)?.prefs) || {};
    if (body.links_prefs && typeof body.links_prefs === 'object') {
      const view = (body.links_prefs as { view?: string }).view === 'list' ? 'list' : 'cards';
      patch.links_prefs = Object.assign({}, (cur.links_prefs as object) || {}, { view });
    }
    if (body.docs_prefs && typeof body.docs_prefs === 'object') {
      const size = Math.round(Number((body.docs_prefs as { size?: number }).size));
      if (Number.isFinite(size)) {
        patch.docs_prefs = Object.assign({}, (cur.docs_prefs as object) || {}, { size: Math.max(120, Math.min(280, size)) });
      }
    }
    const next = Object.assign({}, cur, patch);
    await session.sql`
      INSERT INTO owner_settings (owner_id, prefs)
      VALUES (${ownerId}, ${JSON.stringify(next)}::jsonb)
      ON CONFLICT (owner_id) DO UPDATE SET prefs = EXCLUDED.prefs
    `;
    return NextResponse.json({ ok: true, prefs: next });
  } catch (err) {
    fail('prefs_patch', err);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
}
