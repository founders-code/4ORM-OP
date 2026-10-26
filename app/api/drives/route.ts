import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { claimBudget } from '@/lib/db';
import { DRIVE_CALLS, listDriveTree } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ drives: [] });
    if (!(await claimBudget(session.sql, session.userId, 'google_drive', DRIVE_CALLS))) {
      return NextResponse.json({ drives: [], status: 'busy' });
    }
    const creds = await loadCredsFor(session.userId);
    const tree = await withCreds(creds, () => listDriveTree());
    return NextResponse.json({ drives: tree?.drives || [], status: tree?.status || 'unavailable' });
  } catch (err) {
    fail('drives', err);
    return NextResponse.json({ drives: [] }, { status: 500 });
  }
}
