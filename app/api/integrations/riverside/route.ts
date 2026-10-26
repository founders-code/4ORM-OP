import { NextResponse } from 'next/server';
import { lastSourceSync } from '@/lib/integrations-records';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';
import { riversideConfigured, syncRiverside } from '@/lib/riverside';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Riverside connection state for the Integrations row. Chad and test users only. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const at = session.sql ? await lastSourceSync(session.sql, ownerId, 'riverside') : 0;
    return NextResponse.json({ configured: riversideConfigured(), syncedAt: at ? new Date(at).toISOString() : '' });
  } catch (err) {
    fail('riverside_status', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

/** Sync now: recent Riverside items into Zoom notes (source "Riverside"). Additive; never overwrites edits made in 4orm. */
export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    if (!riversideConfigured()) return NextResponse.json({ error: 'Set RIVERSIDE_API_KEY in Vercel first.', status: 'not_connected' }, { status: 409 });
    if (!(await takeRateLimit(session.sql, 'riverside_sync', ownerId, 6, 300).catch(() => true))) {
      return NextResponse.json({ error: 'Riverside synced a moment ago. Try again in a few minutes.' }, { status: 429 });
    }
    const result = await syncRiverside(session.sql, ownerId);
    if (!result.ok) {
      const error = ('error' in result && result.error) || 'Riverside did not answer.';
      return NextResponse.json({ ...result, error }, { status: result.status === 'bad_key' ? 401 : 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    fail('riverside_sync_route', err);
    return NextResponse.json({ error: 'Riverside sync failed.' }, { status: 500 });
  }
}
