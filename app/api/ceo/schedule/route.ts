import { NextResponse } from 'next/server';
import { scheduleSuggest } from '@/lib/ceo';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 4IQ on the calendar: suggested blocks for the next 7 days. Read-only; nothing is added until Chad presses Add. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!(await takeRateLimit(session.sql, 'ceo_schedule', ownerId, 12, 600))) {
      return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
    }
    const out = await scheduleSuggest(session.sql, session.userId);
    if (out.model === 'none') return NextResponse.json({ ...out, error: '4IQ did not answer. Try again.' }, { status: 502 });
    return NextResponse.json(out);
  } catch (err) {
    fail('ceo_schedule', err);
    return NextResponse.json({ error: '4IQ is unavailable right now.' }, { status: 500 });
  }
}
