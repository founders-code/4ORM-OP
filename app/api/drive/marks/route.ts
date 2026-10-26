import { NextResponse } from 'next/server';
import { driveIdOk, driveSpaceLinks, listDriveMarks, orderDrivePins, setDriveMark } from '@/lib/drive-marks';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Drive stars (folders), pins ("Pinned for the raise") and file → Space links. Chad and test users only. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const marks = await listDriveMarks(session.sql, session.userId);
    const links = await driveSpaceLinks(session.sql, session.userId);
    return NextResponse.json({ ...marks, links });
  } catch (err) {
    fail('drive_marks_get', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

/** { kind:'star'|'pin', id, on, name?, url?, mime?, thumb?, modified? }  or  { kind:'pin', order:[ids] } */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const kind = body?.kind === 'pin' ? 'pin' : body?.kind === 'star' ? 'star' : '';
    if (!kind) return NextResponse.json({ error: 'kind must be star or pin' }, { status: 400 });
    if (kind === 'pin' && Array.isArray(body?.order)) {
      const n = await orderDrivePins(session.sql, session.userId, (body!.order as unknown[]).map((x) => String(x || '')));
      return NextResponse.json({ ok: true, ordered: n, ...(await listDriveMarks(session.sql, session.userId)) });
    }
    const id = String(body?.id || '');
    if (!driveIdOk(id)) return NextResponse.json({ error: 'Not a Drive id' }, { status: 400 });
    await setDriveMark(session.sql, session.userId, {
      id,
      kind,
      on: body?.on !== false,
      name: body?.name,
      url: body?.url,
      mime: body?.mime,
      thumb: body?.thumb,
      modified: body?.modified,
    });
    return NextResponse.json({ ok: true, ...(await listDriveMarks(session.sql, session.userId)) });
  } catch (err) {
    fail('drive_marks_post', err);
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
}
