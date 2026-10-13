import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { addReach, listReach } from '@/lib/reach';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ people: [] });
    const people = await listReach(session.sql, session.userId);
    return NextResponse.json({ people });
  } catch (err) {
    fail('reach_list', err);
    return NextResponse.json({ people: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ name: String(body.name || 'Person'), saved: false });
    const person = await addReach(session.sql, session.userId, body);
    if (!person) return NextResponse.json({ name: String(body.name || 'Person'), saved: false });
    return NextResponse.json(person);
  } catch (err) {
    fail('reach_add', err);
    return NextResponse.json({ saved: false });
  }
}
