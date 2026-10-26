import { NextResponse } from 'next/server';
import { PANEL_KEYS, kindsSince, latestCursor, panelFingerprints, parseFingerprints, readBoardItems } from '@/lib/changes';
import { changePayload } from '@/lib/live';
import { fail } from '@/lib/log';
import { listMeetingActions } from '@/lib/meeting-actions';
import { listReach } from '@/lib/reach';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ cursor: '0', kinds: [], bytes: 0 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const query = new URL(req.url).searchParams;
    const since = query.get('since') || '0';
    const kinds: string[] = await kindsSince(session.sql, ownerId, since);
    const cursor = await latestCursor(session.sql, ownerId);
    const panels: Record<string, unknown> = kinds.length ? await changePayload(session.sql, ownerId, kinds as Parameters<typeof changePayload>[2]) : {};
    // W56: owed / reach / cold counts and the item columns, shipped only when their fingerprint moved.
    const fps = await panelFingerprints(session.sql, ownerId);
    const seen = parseFingerprints(query.get('fp') || '');
    const first = !query.get('fp');
    for (const key of PANEL_KEYS) {
      if (first || !fps[key] || seen[key] === fps[key]) continue;
      try {
        if (key === 'items') panels.items = await readBoardItems(session.sql, ownerId);
        if (key === 'owed') panels.meetingActions = await listMeetingActions(session.sql, ownerId);
        if (key === 'reach') panels.reach = await listReach(session.sql, ownerId);
        if (key === 'people' && !kinds.includes('people')) {
          const extra = await changePayload(session.sql, ownerId, ['people']);
          panels.people = extra.people;
        }
        if (!kinds.includes(key)) kinds.push(key);
      } catch (err) {
        fail(`changes_${key}`, err);
      }
    }
    const fp = PANEL_KEYS.map((key) => fps[key] || '0').join('.');
    const body = { cursor, kinds, fp, ...panels };
    const json = JSON.stringify(body);
    return NextResponse.json({ ...body, bytes: Buffer.byteLength(json) });
  } catch (err) {
    fail('changes', err);
    return NextResponse.json({ cursor: '0', kinds: [], bytes: 0 }, { status: 500 });
  }
}
