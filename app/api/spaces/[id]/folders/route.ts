import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { addSpaceFolder, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name || body.title || 'Untitled folder').trim().slice(0, 120) || 'Untitled folder';
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ name, saved: false }, { status: session.sql ? 400 : 503 });
    const added = await addSpaceFolder(session.sql, session.userId, params.id, name, String(body.parentId || body.parent_id || body.folderId || ''));
    if (!added) return NextResponse.json({ name, saved: false }, { status: 404 });
    return NextResponse.json({ id: params.id, item: added.item, package: added.package || added });
  } catch (err) {
    fail('spaces_folder', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
