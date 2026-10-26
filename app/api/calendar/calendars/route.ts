import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';
import { listCalendars } from '../_google-calendars';

export const dynamic = 'force-dynamic';

/** C22: the user's Google calendars for the editor's Calendar select (id, name, colour, writable, source). */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const creds = await loadCredsFor(session.userId);
    const calendars = await withCreds(creds, () => listCalendars());
    if (!calendars) return NextResponse.json({ calendars: [], error: 'Google Calendar did not answer.' }, { status: 502 });
    return NextResponse.json({ calendars });
  } catch (err) {
    fail('calendar_list', err);
    return NextResponse.json({ calendars: [], error: 'Unavailable' }, { status: 500 });
  }
}
