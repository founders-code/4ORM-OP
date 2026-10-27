import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { part: string } }) {
  const t0 = Date.now();
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const part = String(ctx.params.part || '');
    let ok = true;
    let reading = 'ok';
    if (part === 'db') {
      ok = !!session.sql;
      if (session.sql) await session.sql`SELECT 1`;
      reading = ok ? 'round trip' : 'no database';
    } else if (part === 'keys') {
      ok = !!process.env.OPENAI_API_KEY;
      reading = ok ? 'present' : 'OPENAI_API_KEY missing';
    } else if (part === 'session') {
      reading = 'signed in';
    }
    const ms = Date.now() - t0;
    if (session.sql) {
      await session.sql`INSERT INTO health_runs (part, ok, ms, reading) VALUES (${part}, ${ok}, ${ms}, ${reading})`.catch(() => {});
    }
    return NextResponse.json({ part, ok, ms, reading });
  } catch (err) {
    fail('health_part', err);
    return NextResponse.json({ ok: false, ms: Date.now() - t0, reading: 'failed' }, { status: 500 });
  }
}
