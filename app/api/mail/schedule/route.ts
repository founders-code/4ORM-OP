import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { createScheduled, ensureScheduledMail, listScheduled } from '@/lib/schedule';
import { readMessage, readSendAt, schedulePresets } from '@/lib/schedule-core.mjs';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Scheduled sends (B34). Chad and test users only; everyone else 403. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    await ensureScheduledMail(session.sql);
    const items = await listScheduled(session.sql, ownerId);
    return NextResponse.json({ items, presets: schedulePresets(), cron: !!process.env.CRON_SECRET });
  } catch (err) {
    fail('mail_schedule_list', err);
    return NextResponse.json({ error: 'Scheduled mail could not be read.' }, { status: 500 });
  }
}

/**
 * Queue one fully composed message. Body: { to, cc, bcc, subject, text, threadId?, messageId?, reply?,
 * attachments?, nudge?, log?, date: 'YYYY-MM-DD', time: 'HH:MM' } (America/Vancouver) or { sendAt }.
 */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const when = readSendAt(body);
    if (!when.ok) return NextResponse.json({ error: when.error }, { status: 400 });
    const msg = readMessage(body);
    if (!msg.ok || !msg.message) return NextResponse.json({ error: msg.error }, { status: 400 });
    await ensureScheduledMail(session.sql);
    const item = await createScheduled(session.sql, ownerId, session.userId, msg.message, when.at);
    if (!item) return NextResponse.json({ error: 'Could not schedule that email.' }, { status: 500 });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    fail('mail_schedule_create', err);
    return NextResponse.json({ error: 'Could not schedule that email.' }, { status: 500 });
  }
}
