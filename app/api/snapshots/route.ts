import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { getSnapshot, listSnapshots, pacificDay, saveSnapshot } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ snapshots: [] });
    const date = new URL(req.url).searchParams.get('date') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const one = await getSnapshot(session.sql, session.userId, date).catch((err) => {
        fail('snap_get', err);
        return null;
      });
      return NextResponse.json(one || { date, summary: '', payload: null });
    }
    // A failed read is a 500, so Completed can show "Couldn't load - Retry" instead of an empty history.
    const snapshots = await listSnapshots(session.sql, session.userId).catch((err) => {
      fail('snap_list', err);
      return null;
    });
    if (!snapshots) return NextResponse.json({ snapshots: [], error: 'Could not load snapshots.' }, { status: 500 });
    return NextResponse.json({ snapshots });
  } catch (err) {
    fail('snap_failed', err);
    return NextResponse.json({ snapshots: [], error: 'Could not load snapshots.' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false, date: pacificDay(), summary: '', payload: {} }, { status: 503 });
    const built = await saveSnapshot(session.sql, session.userId).catch((err) => {
      fail('snap_save', err);
      return null;
    });
    if (!built) return NextResponse.json({ ok: false, date: pacificDay(), summary: '', payload: {} }, { status: 500 });
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    fail('snap_post', err);
    return NextResponse.json({ ok: false, snapshots: [] }, { status: 500 });
  }
}
