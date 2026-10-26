import { NextResponse } from 'next/server';
import { lastSourceSync } from '@/lib/integrations-records';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';
import { granolaConfigured, syncGranola } from '@/lib/granola';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Granola connection state for the Integrations row. Chad and test users only. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const at = session.sql ? await lastSourceSync(session.sql, ownerId, 'granola') : 0;
    return NextResponse.json({ configured: granolaConfigured(), syncedAt: at ? new Date(at).toISOString() : '' });
  } catch (err) {
    fail('granola_status', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

/** Sync now: recent Granola items into Zoom notes (source "Granola"). Additive; never overwrites edits made in 4orm. */
export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    if (!granolaConfigured()) return NextResponse.json({ error: 'Set GRANOLA_API_KEY in Vercel first.', status: 'not_connected' }, { status: 409 });
    if (!(await takeRateLimit(session.sql, 'granola_sync', ownerId, 6, 300).catch(() => true))) {
      return NextResponse.json({ error: 'Granola synced a moment ago. Try again in a few minutes.' }, { status: 429 });
    }
    const result = await syncGranola(session.sql, ownerId);
    if (!result.ok) {
      const error = ('error' in result && result.error) || 'Granola did not answer.';
      return NextResponse.json({ ...result, error }, { status: result.status === 'bad_key' ? 401 : 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    fail('granola_sync_route', err);
    return NextResponse.json({ error: 'Granola sync failed.' }, { status: 500 });
  }
}
