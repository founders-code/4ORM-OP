import { NextResponse } from 'next/server';
import { listExpenses } from '@/lib/expenses';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Owner only. Feeds the calendar's $ switch: name, how often, which day, amount. Never written to Google Calendar. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ expenses: [] }, { status: 503 });
    const list = await listExpenses(session.sql, ownerId);
    return NextResponse.json({ expenses: list.map(({ name, freq, day, month, amount }) => ({ name, freq, day, month, amount })) });
  } catch (err) {
    fail('expense_days', err);
    return NextResponse.json({ expenses: [] }, { status: 500 });
  }
}
