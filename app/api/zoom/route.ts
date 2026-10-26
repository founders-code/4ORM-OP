import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Could not save that note.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const title = String(body?.title || '').trim().slice(0, 180) || 'Untitled meeting';
    const noteId = `manual-${Date.now()}`;
    const others = JSON.stringify(String(body?.others || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 40));
    const names = String(body?.attendees || '').split(',').map((line) => line.trim()).filter(Boolean).slice(0, 20);
    const attendees = JSON.stringify(names);
    const solo = body?.solo === true || !names.length;
    const rows = await session.sql`
      INSERT INTO zoom_notes (owner_id, note_id, note_date, title, attendees, solo, others, intel, improve, sources)
      VALUES (
        ${session.userId}, ${noteId}, CURRENT_DATE, ${title}, ${attendees}::jsonb, ${solo},
        ${others}::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
      )
      RETURNING id, note_id, note_date::text AS note_date, title, attendees, solo, others, intel, improve, sources
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    fail('zoom_note', err);
    return NextResponse.json({ error: 'Could not save that note.' }, { status: 400 });
  }
}
