import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { createSpace, listSpaces } from '@/lib/spaces';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function askedName(body: Record<string, unknown> | null) {
  return String(body?.name || body?.title || '').trim().slice(0, 120) || 'Untitled space';
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ spaces: [], packages: [] });
    const listed = await listSpaces(session.sql, session.userId);
    return NextResponse.json(listed);
  } catch (err) {
    fail('spaces_list', err);
    return NextResponse.json({ spaces: [], packages: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = askedName(body);
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) {
      fail('spaces_create', 'no database');
      return NextResponse.json({ name, saved: false }, { status: 503 });
    }
    try {
      const created = await createSpace(session.sql, session.userId, { ...(body || {}), name });
      if (created?.id) return NextResponse.json(created);
      fail('spaces_create', 'insert returned no row');
    } catch (err) {
      fail('spaces_create', err);
    }
    try {
      const { createPackage } = await import('@/lib/packages');
      const fallback = await createPackage(session.sql, session.userId, name, String(body?.kind || ''), {
        spaceType: String(body?.spaceType || 'project'),
        subjectLabel: name,
        description: String(body?.description || body?.notes || ''),
      });
      if (fallback?.id) return NextResponse.json(fallback);
      fail('spaces_create', 'package fallback returned no row');
    } catch (err) {
      fail('spaces_create', err);
    }
    return NextResponse.json({ name, saved: false }, { status: 500 });
  } catch (err) {
    fail('spaces_create', err);
    return NextResponse.json({ name, saved: false }, { status: 500 });
  }
}
