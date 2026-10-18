import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { getSnapshot, listSnapshots, pacificDay, saveSnapshot } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ snapshots: [] });
    const date = new URL(req.url).searchParams.get('date') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const one = await getSnapshot(session.sql, session.userId, date).catch((err) => {
        fail('snap_get', err);
        return null;
      });
      return NextResponse.json(one || { date, summary: '', payload: null });
    }
    const snapshots = await listSnapshots(session.sql, session.userId).catch((err) => {
      fail('snap_list', err);
      return [];
    });
    return NextResponse.json({ snapshots });
  } catch (err) {
    fail('snap_failed', err);
    return NextResponse.json({ snapshots: [] });
  }
}

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ ok: false, date: pacificDay(), summary: '', payload: {} });
    const built = await saveSnapshot(session.sql, session.userId).catch((err) => {
      fail('snap_save', err);
      return null;
    });
    if (!built) return NextResponse.json({ ok: false, date: pacificDay(), summary: '', payload: {} });
    return NextResponse.json({ ok: true, ...built });
  } catch (err) {
    fail('snap_post', err);
    return NextResponse.json({ ok: false, snapshots: [] });
  }
}
