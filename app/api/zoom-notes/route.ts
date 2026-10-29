import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { claimBudget } from '@/lib/db';
import { zoomMail } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';
import { syncMyNotes } from '@/lib/zoom-notes-user';
import { filledZoomIds, lastZoomSync, saveMailNotes, syncZoomApi, zoomConfigured } from '@/lib/zoom';
import { listZoomNotes, seedZoomNotes } from '@/lib/zoom-notes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ notes: [], error: 'Unavailable' }, { status: 503 });
    await seedZoomNotes(session.sql, session.userId);
    const notes = await listZoomNotes(session.sql, session.userId);
    const syncedAt = await lastZoomSync(session.sql, session.userId);
    return NextResponse.json({ notes, syncedAt, zoom: zoomConfigured() ? 'connected' : 'not_connected' });
  } catch {
    fail('zoom_notes_failed');
    // A real error code, so the Zoom page shows "Couldn't load - Retry" instead of an empty list.
    return NextResponse.json({ notes: [], error: 'Unavailable' }, { status: 500 });
  }
}

/** Refresh on demand: every recent Zoom recording and transcript, plus Zoom summary emails, de-duped by meeting. */
export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false, notes: [], error: 'Unavailable' }, { status: 503 });
    const sql = session.sql;
    await seedZoomNotes(sql, session.userId);
    if (!(await claimBudget(sql, session.userId, 'zoom', 25))) {
      const notes = await listZoomNotes(sql, session.userId);
      return NextResponse.json({ ok: false, busy: true, notes, error: 'Zoom refreshed a moment ago. Try again in a few minutes.' }, { status: 429 });
    }
    const known = await filledZoomIds(sql, session.userId);
    const api = await syncZoomApi(sql, session.userId, known).catch((err) => {
      fail('zoom_sync', err);
      return { added: 0, filled: 0, seen: 0, zoom: 'unavailable' as const };
    });
    const notesSync = await syncMyNotes(sql, session.userId, await filledZoomIds(sql, session.userId)).catch((err) => {
      fail('zoom_my_notes_sync', err);
      return { connected: false, meetings: 0, added: 0, reason: 'error' };
    });
    const mailKnown = new Set([...known].filter((id) => id.startsWith('gmail-')).map((id) => id.slice(6)));
    const creds = await loadCredsFor(session.userId);
    const mails = await withCreds(creds, () => zoomMail(mailKnown, 20)).catch((err) => {
      fail('zoom_mail', err);
      return null;
    });
    const mailAdded = mails ? await saveMailNotes(sql, session.userId, mails) : 0;
    const notes = await listZoomNotes(sql, session.userId);
    return NextResponse.json({
      ok: true,
      added: api.added + mailAdded + notesSync.added,
      myNotes: notesSync,
      filled: api.filled,
      seen: api.seen,
      zoom: api.zoom,
      reason: 'reason' in api ? api.reason || '' : '',
      gmail: mails ? 'connected' : 'unavailable',
      notes,
    });
  } catch (err) {
    fail('zoom_refresh', err);
    return NextResponse.json({ ok: false, notes: [], error: 'Unavailable' }, { status: 500 });
  }
}
