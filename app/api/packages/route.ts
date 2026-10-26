import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { createPackage, listPackages } from '@/lib/packages';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ packages: [] });
    const packages = await listPackages(session.sql, session.userId);
    return NextResponse.json({ packages });
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ packages: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const created = await createPackage(session.sql, session.userId, String(body?.name || ''), String(body?.kind || ''), {
      spaceType: String(body?.spaceType || ''),
      subjectContactId: String(body?.subjectContactId || ''),
      subjectLabel: String(body?.subjectLabel || ''),
      description: String(body?.description || ''),
      spaceCategory: String(body?.spaceCategory || body?.category || ''),
    });
    if (!created) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(created);
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
