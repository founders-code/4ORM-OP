import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { listMeetingActions, markMeetingAction } from '@/lib/meeting-actions';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

function empty() {
  return NextResponse.json({ ok: true, actions: [] as unknown[] });
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ ok: false, actions: [], error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return empty();
    const actions = await listMeetingActions(session.sql, session.userId);
    return NextResponse.json({ ok: true, actions });
  } catch (err) {
    fail('meeting_actions_get', err);
    return empty();
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ ok: false, actions: [], error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return empty();
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const status = String(body?.status || 'tasked');
    if (!id) return empty();
    const actions = await markMeetingAction(session.sql, session.userId, id, status);
    return NextResponse.json({ ok: true, actions });
  } catch (err) {
    fail('meeting_actions_post', err);
    return empty();
  }
}
