import { NextResponse } from 'next/server';
import { dailyCeo, refreshCeo } from '@/lib/ceo';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { ceoKey } from '@/lib/secrets';
import { getSql } from '@/lib/db';
import { openBoard, roomOwner, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function target(req: Request) {
  const key = req.headers.get('x-ceo-key');
  if (key) {
    const expected = ceoKey();
    if (!expected || !tokenOk(key, expected)) return null;
    const sql = await getSql();
    if (!sql) return null;
    const ownerId = await roomOwner(sql);
    return ownerId ? { sql, userId: ownerId } : null;
  }
  const session = await openBoard();
  if (!session) return null;
  // Signed-in callers must be allowlisted (see sessionOwner); everyone else is refused.
  const ownerId = await sessionOwner(session);
  if (!ownerId) return null;
  if (!session.sql) return { sql: null, userId: ownerId };
  return { sql: session.sql, userId: ownerId };
}

export async function POST(req: Request) {
  try {
    const who = await target(req);
    if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!who.sql) return NextResponse.json({ moves: [] }, { status: 503 });
    const body = await req.json().catch(() => ({})) as { moves?: unknown };
    const desk = await dailyCeo(who.sql, who.userId, Array.isArray(body.moves) ? body.moves : null);
    return NextResponse.json(desk || { moves: [] });
  } catch (err) {
    fail('ceo_daily', err);
    try {
      const session = await openBoard();
      const fallbackOwner = session ? await sessionOwner(session) : null;
      if (session?.sql && fallbackOwner) return NextResponse.json(await refreshCeo(session.sql, fallbackOwner));
    } catch {
      /* fail soft */
    }
    return NextResponse.json({ moves: [] }, { status: 500 });
  }
}
