import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { moveSpaceToDrive, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !spaceIdOk(params.id)) {
      return NextResponse.json({ ok: false, error: 'Drive could not take this Space. The staged files are still here.' });
    }
    const pushed = await moveSpaceToDrive(session.sql, session.userId, params.id);
    if (!pushed) return NextResponse.json({ ok: false, error: 'Drive could not take this Space. The staged files are still here.' });
    return NextResponse.json(pushed);
  } catch (err) {
    fail('spaces_drive', err);
    return NextResponse.json({ ok: false, error: 'Drive could not take this Space. The staged files are still here.' });
  }
}
