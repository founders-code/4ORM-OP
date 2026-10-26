import { NextResponse } from 'next/server';
import { ensureCeo, snoozeMove } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ moves: [] });
    const desk = await ensureCeo(session.sql, session.userId);
    return NextResponse.json({ moves: desk?.moves || [] });
  } catch (err) {
    fail('ceo_moves', err);
    return NextResponse.json({ moves: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const id = String(body.id || '');
    if (!session.sql || !id) return NextResponse.json({ ok: false }, { status: session.sql ? 400 : 503 });
    const action = String(body.action || 'snooze');
    if (action === 'snooze' || action === 'dismiss' || action === 'not-now') {
      const result = await snoozeMove(session.sql, session.userId, id, String(body.reason || action));
      return NextResponse.json(result || { ok: true });
    }
    return NextResponse.json({ ok: true, id, action });
  } catch (err) {
    fail('ceo_moves', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
