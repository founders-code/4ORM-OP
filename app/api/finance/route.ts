import { NextResponse } from 'next/server';
import { financeDesk } from '@/lib/finance';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const desk = await financeDesk(session.sql, session.userId);
    return NextResponse.json(desk);
  } catch (err) {
    fail('finance_failed', err);
    return NextResponse.json(await financeDesk(null, '').catch(() => ({
      code: '1313',
      cash: 100,
      burnMonthly: 90050,
      runwayDays: 1,
      raise: { in: 80000, pending: 0, open: 170000, target: 250000, pace: 'behind' },
      cheques: [],
      expenses: [],
      scenarios: [],
    })));
  }
}
