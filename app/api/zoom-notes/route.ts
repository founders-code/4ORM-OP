import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { listZoomNotes, seedZoomNotes } from '@/lib/zoom-notes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    await seedZoomNotes(session.sql, session.userId);
    const notes = await listZoomNotes(session.sql, session.userId);
    return NextResponse.json({ notes });
  } catch {
    fail('zoom_notes_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
