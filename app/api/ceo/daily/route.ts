import { NextResponse } from 'next/server';
import { dailyCeo, refreshCeo } from '@/lib/ceo';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { ceoKey } from '@/lib/secrets';
import { getSql } from '@/lib/db';
import { openBoard, roomOwner } from '@/lib/session';

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
  if (!session || !session.sql) return session ? { sql: null, userId: session.userId } : null;
  return { sql: session.sql, userId: session.userId };
}

export async function POST(req: Request) {
  try {
    const who = await target(req);
    if (!who) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!who.sql) return NextResponse.json({ moves: [] });
    const body = await req.json().catch(() => ({})) as { moves?: unknown };
    const desk = await dailyCeo(who.sql, who.userId, Array.isArray(body.moves) ? body.moves : null);
    return NextResponse.json(desk || { moves: [] });
  } catch (err) {
    fail('ceo_daily', err);
    try {
      const session = await openBoard();
      if (session?.sql) return NextResponse.json(await refreshCeo(session.sql, session.userId));
    } catch {
      /* fail soft */
    }
    return NextResponse.json({ moves: [] });
  }
}
