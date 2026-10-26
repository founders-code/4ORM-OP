import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { listSocialQueue } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ left: 0, cadence: 0 });
    const creds = await loadCredsFor(session.userId);
    const queue = await withCreds(creds, () => listSocialQueue());
    if (!queue) return NextResponse.json({ left: 0, cadence: 0, empty: true });
    return NextResponse.json(queue);
  } catch (err) {
    fail('content_queue', err);
    return NextResponse.json({ left: 0, cadence: 0, empty: true }, { status: 500 });
  }
}
