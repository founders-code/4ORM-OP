import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { clearIntegration } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const WHICH: Record<string, string> = { google: 'google', gohighlevel: 'ghl' };

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const which = WHICH[String(params.id || '')];
    if (!which) return NextResponse.json({ error: 'Could not disconnect that integration.' }, { status: 400 });
    const ok = await clearIntegration(session.userId, which);
    if (!ok) return NextResponse.json({ error: 'Could not disconnect that integration.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('disconnect', err);
    return NextResponse.json({ error: 'Could not disconnect that integration.' }, { status: 400 });
  }
}
