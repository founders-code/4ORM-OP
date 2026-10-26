import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { cancelScheduled, editScheduled, ensureScheduledMail, getScheduled, hideScheduled, rescheduleScheduled } from '@/lib/schedule';
import { readMessage, readSendAt } from '@/lib/schedule-core.mjs';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;
type Ctx = { params: { id: string } };

async function gate(ctx: Ctx) {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { error: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  const id = String(ctx.params?.id || '');
  if (!ID.test(id)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  await ensureScheduledMail(session.sql);
  return { sql: session.sql, ownerId, id };
}

const GONE = 'That email is already sending or sent, so it can no longer change.';

/** Edit a queued (or failed) send: the full message and time, or { date, time } alone to reschedule. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const g = await gate(ctx);
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const when = readSendAt(body);
    if (!when.ok) return NextResponse.json({ error: when.error }, { status: 400 });
    const onlyTime = body && !('to' in body) && !('subject' in body) && !('text' in body);
    let item;
    if (onlyTime) item = await rescheduleScheduled(g.sql, g.ownerId, g.id, when.at);
    else {
      const msg = readMessage(body);
      if (!msg.ok || !msg.message) return NextResponse.json({ error: msg.error }, { status: 400 });
      item = await editScheduled(g.sql, g.ownerId, g.id, msg.message, when.at);
    }
    if (!item) {
      const now = await getScheduled(g.sql, g.ownerId, g.id);
      return NextResponse.json({ error: now ? GONE : 'Not found', item: now }, { status: now ? 409 : 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    fail('mail_schedule_edit', err);
    return NextResponse.json({ error: 'Could not change that email.' }, { status: 500 });
  }
}

/** { action: 'cancel' } stops a queued send. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const g = await gate(ctx);
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (String(body?.action || '') !== 'cancel') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    const item = await cancelScheduled(g.sql, g.ownerId, g.id);
    if (!item) {
      const now = await getScheduled(g.sql, g.ownerId, g.id);
      return NextResponse.json({ error: now ? GONE : 'Not found', item: now }, { status: now ? 409 : 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    fail('mail_schedule_cancel', err);
    return NextResponse.json({ error: 'Could not cancel that email.' }, { status: 500 });
  }
}

/** Hide a sent, cancelled or failed row from the list (soft delete; the row stays in the table). */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const g = await gate(ctx);
    if ('error' in g) return g.error;
    const ok = await hideScheduled(g.sql, g.ownerId, g.id);
    if (!ok) return NextResponse.json({ error: 'Cancel it first, or it is already gone.' }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('mail_schedule_hide', err);
    return NextResponse.json({ error: 'Could not remove that row.' }, { status: 500 });
  }
}
