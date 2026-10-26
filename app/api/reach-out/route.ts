import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { addReach, listReach } from '@/lib/reach';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ people: [] });
    const people = await listReach(session.sql, session.userId);
    return NextResponse.json({ people });
  } catch (err) {
    fail('reach_list', err);
    return NextResponse.json({ people: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ name: String(body.name || 'Person'), saved: false }, { status: 503 });
    const person = await addReach(session.sql, session.userId, body);
    if (!person) return NextResponse.json({ name: String(body.name || 'Person'), saved: false }, { status: 400 });
    return NextResponse.json(person);
  } catch (err) {
    fail('reach_add', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
