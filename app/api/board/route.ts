import { NextResponse } from 'next/server';
import { idleBoard, loadBoard } from '@/lib/board';
import { withCreds, type SessionCreds } from '@/lib/creds';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const blankCreds: SessionCreds = { googleRefresh: '', ghlKey: '', ghlLocation: '' };

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) {
      fail('board_database', 'no database connection');
      return NextResponse.json(idleBoard(true));
    }
    let creds = blankCreds;
    try {
      creds = await loadCredsFor(session.userId);
    } catch (err) {
      fail('board_creds', err);
    }
    const board = await withCreds(creds, () => loadBoard(session.sql!, session.userId));
    return NextResponse.json(board);
  } catch (err) {
    fail('board_failed', err);
    return NextResponse.json({ ...idleBoard(false), reads: { board: 'failed' } }, { status: 500 });
  }
}
