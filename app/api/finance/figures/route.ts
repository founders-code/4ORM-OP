import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FINANCE_COOKIE, financeUnlocked } from '@/lib/finance';
import { setFigures } from '@/lib/finance-figures';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Save cash, raised so far, raise target and close date. Behind the Financials code. */
export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!financeUnlocked(cookies().get(FINANCE_COOKIE)?.value, session.userId)) return NextResponse.json({ locked: true }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const r = await setFigures(session.sql, ownerId, body);
    if ('error' in r) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  } catch (err) {
    fail('finance_figures', err);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
}
