import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { addSpaceRecipient, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ saved: false });
    const saved = await addSpaceRecipient(session.sql, session.userId, params.id, body);
    if (!saved) return NextResponse.json({ saved: false });
    return NextResponse.json(saved);
  } catch (err) {
    fail('spaces_recipient', err);
    return NextResponse.json({ saved: false });
  }
}
