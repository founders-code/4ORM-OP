import { NextResponse } from 'next/server';
import { kindsSince, latestCursor } from '@/lib/changes';
import { changePayload } from '@/lib/live';
import { fail } from '@/lib/log';
import { openBoard, roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ cursor: '0', kinds: [], bytes: 0 });
    const ownerId = (await roomOwner(session.sql)) || session.userId;
    const since = new URL(req.url).searchParams.get('since') || '0';
    const kinds = await kindsSince(session.sql, ownerId, since);
    const cursor = await latestCursor(session.sql, ownerId);
    const panels = kinds.length ? await changePayload(session.sql, ownerId, kinds) : {};
    const body = { cursor, kinds, ...panels };
    const json = JSON.stringify(body);
    return NextResponse.json({ ...body, bytes: Buffer.byteLength(json) });
  } catch (err) {
    fail('changes', err);
    return NextResponse.json({ cursor: '0', kinds: [], bytes: 0 });
  }
}
