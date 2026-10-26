import { NextResponse } from 'next/server';
import { isUniqueViolation } from '@/lib/db';
import { fail } from '@/lib/log';
import { readMeetingActionColumn, readMeetingActionStatus, updateMeetingAction } from '@/lib/meeting-actions';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

/**
 * Tick, dismiss, reopen or move one "from Zoom" card by its meeting-action id.
 * Body: { status?: 'open' | 'done' | 'tasked' | 'dismissed' ('handled' = dismissed), column?: 'today' | 'week' | 'later' }
 * Answers { ok: true, action } or 400 (bad input) / 404 (not yours or gone) / 409 (reopen clashes with an open copy).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status');
    const hasColumn = Object.prototype.hasOwnProperty.call(body, 'column');
    const status = hasStatus ? readMeetingActionStatus(body.status) : null;
    const column = hasColumn ? readMeetingActionColumn(body.column) : null;
    if ((hasStatus && !status) || (hasColumn && !column) || (!status && !column)) {
      return NextResponse.json({ error: 'Send status (open, done, tasked, dismissed) and/or column (today, week, later).' }, { status: 400 });
    }
    const action = await updateMeetingAction(session.sql, session.userId, params.id, { status, column });
    if (!action) return NextResponse.json({ error: 'Action not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, action });
  } catch (err) {
    if (isUniqueViolation(err)) return NextResponse.json({ error: 'That action is already open.' }, { status: 409 });
    fail('meeting_action_patch', err);
    return NextResponse.json({ error: 'Could not update that action.' }, { status: 500 });
  }
}

/** Dismiss (never a hard delete). Reopen with PATCH { status: 'open' }. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    const action = await updateMeetingAction(session.sql, session.userId, params.id, { status: 'dismissed' });
    if (!action) return NextResponse.json({ error: 'Action not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, action });
  } catch (err) {
    fail('meeting_action_delete', err);
    return NextResponse.json({ error: 'Could not dismiss that action.' }, { status: 500 });
  }
}
