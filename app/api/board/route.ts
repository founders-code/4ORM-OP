import { NextResponse } from 'next/server';
import { loadBoard } from '@/lib/board';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const board = await loadBoard(session.sql, session.userId);
    return NextResponse.json(board);
  } catch {
    fail('board_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
