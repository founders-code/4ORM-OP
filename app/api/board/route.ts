import { NextResponse } from 'next/server';
import { idleBoard, loadBoard } from '@/lib/board';
import { withCreds } from '@/lib/creds';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json(idleBoard(true));
    const creds = await loadCredsFor(session.userId);
    const board = await withCreds(creds, () => loadBoard(session.sql!, session.userId));
    return NextResponse.json(board);
  } catch {
    fail('board_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
