import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { gmailThread } from '@/lib/google';
import { fail } from '@/lib/log';
import { assistFor, listContactHits } from '@/lib/mail-board';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Gmail is read with the room's Google credentials: only the allowlisted owner (see sessionOwner) may use it.
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = String(new URL(req.url).searchParams.get('id') || '');
    if (!session.sql) return NextResponse.json({ thread: null });
    const creds = await loadCredsFor(session.userId);
    const thread = await withCreds(creds, () => gmailThread(id)).catch((err) => {
      fail('mail_thread', err);
      return null;
    });
    if (!thread) return NextResponse.json({ thread: null });
    const contacts = await listContactHits(session.sql, session.userId);
    const email = ((thread.from.match(/<([^>]+)>/) || [])[1] || thread.from).trim().toLowerCase();
    const name = thread.from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim().toLowerCase();
    const contact = contacts.find((c) => (c.email && c.email === email) || (c.name && c.name.toLowerCase() === name)) || null;
    return NextResponse.json({ thread, assist: assistFor(thread, contact), contact });
  } catch (err) {
    fail('mail_thread', err);
    return NextResponse.json({ thread: null });
  }
}
