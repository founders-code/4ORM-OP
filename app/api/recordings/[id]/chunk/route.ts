import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { saveChunk } from '@/lib/recordings';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const id = String(ctx.params.id || '');
    if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await saveChunk(session.sql, session.userId, id, Number(body.n) || 0, String(body.b64 || body.payload || ''));
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('recording_chunk', err);
    return NextResponse.json({ error: 'Could not save chunk.' }, { status: 500 });
  }
}
