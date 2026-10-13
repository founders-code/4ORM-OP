import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { createEvent, listEvents } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { openSlots } from '@/lib/slots.mjs';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const now = Date.now();
    if (!session.sql) return NextResponse.json({ slots: openSlots(now, []) });
    const start = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    const end = new Date(now + 36 * 60 * 60 * 1000).toISOString();
    const creds = await loadCredsFor(session.userId);
    const listed = await withCreds(creds, () => listEvents(start, end));
    const busy = (listed?.events || []).flatMap((event) => {
      if (!event) return [];
      return [{ start: event.start, end: event.start + event.dur * 60 * 1000 }];
    });
    return NextResponse.json({
      slots: openSlots(now, busy),
      error: listed && listed.status === 'unavailable' ? 'Calendar could not be read. Open slots are shown without conflicts.' : '',
    });
  } catch (err) {
    fail('slots_failed', err);
    return NextResponse.json({ slots: openSlots(Date.now(), []), error: 'Calendar could not be read.' });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const start = Number(body?.start);
    if (!session.sql || !Number.isFinite(start)) {
      return NextResponse.json({ error: 'Calendar could not book that slot.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    const id = await withCreds(creds, () => createEvent(start, 30, 'Focus block'));
    if (!id) return NextResponse.json({ error: 'Calendar could not book that slot.' }, { status: 400 });
    return NextResponse.json({ id, start });
  } catch (err) {
    fail('slots_failed', err);
    return NextResponse.json({ error: 'Calendar could not book that slot.' }, { status: 400 });
  }
}
