import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { createRecording, listRecordings } from '@/lib/recordings';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ recordings: [] });
    const recordings = await listRecordings(session.sql, session.userId);
    return NextResponse.json({ recordings });
  } catch (err) {
    fail('recordings_get', err);
    return NextResponse.json({ recordings: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rec = await createRecording(session.sql, session.userId, body);
    return NextResponse.json(rec);
  } catch (err) {
    fail('recordings_post', err);
    return NextResponse.json({ error: 'Could not save the recording.' }, { status: 500 });
  }
}
