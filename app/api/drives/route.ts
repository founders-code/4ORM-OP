import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { listDriveTree } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ drives: [] });
    const creds = await loadCredsFor(session.userId);
    const tree = await withCreds(creds, () => listDriveTree());
    return NextResponse.json({ drives: tree?.drives || [], status: tree?.status || 'unavailable' });
  } catch (err) {
    fail('drives', err);
    return NextResponse.json({ drives: [] });
  }
}
