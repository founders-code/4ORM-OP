import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  FINANCE_COOKIE,
  FINANCE_UNLOCK_SECONDS,
  financeCodeOk,
  financeDesk,
  financeUnlockValue,
  financeUnlocked,
} from '@/lib/finance';
import { listExpenses } from '@/lib/expenses';
import { getFigures } from '@/lib/finance-figures';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/finance',
};

async function financeSession() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session, ownerId };
}

/** Numbers only after POST { code } unlocked this browser. Locked → 403 { locked: true }. Never returns the code. */
export async function GET() {
  try {
    const gate = await financeSession();
    if ('error' in gate) return gate.error;
    if (!financeUnlocked(cookies().get(FINANCE_COOKIE)?.value, gate.session.userId)) {
      return NextResponse.json({ locked: true }, { status: 403 });
    }
    const desk = financeDesk();
    /* "Where the money goes": the recurring bills from the expenses list, monthly equivalent, biggest first. */
    if (gate.session.sql) {
      try {
        const list = await listExpenses(gate.session.sql, gate.ownerId);
        /* Burn = every recurring bill as a monthly figure. Cash, raised and target are the figures Chad sets. */
        const burn = Math.round(list.reduce((a, e) => a + (e.freq === 'y' ? e.amount / 12 : e.amount), 0) * 100) / 100;
        const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
        desk.burnMonthly = burn as never;
        desk.burnLabel = money(burn) as never;
        const fig = await getFigures(gate.session.sql, gate.ownerId).catch(() => null);
        if (fig) {
          (desk as Record<string, unknown>).figures = fig;
          if (fig.cash != null) {
            desk.cash = fig.cash as never;
            desk.cashLabel = money(fig.cash) as never;
            desk.asOf = (fig.updatedAt ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Vancouver', day: 'numeric', month: 'short' }).format(new Date(fig.updatedAt)) : null) as never;
            if (burn > 0) {
              const months = fig.cash / burn;
              desk.runwayDays = Math.round(months * 30.4) as never;
              desk.runwayLabel = (months >= 24 ? `${Math.round(months / 12)} years` : `${months.toFixed(1)} months`) as never;
            }
          }
          if (fig.raiseIn != null || fig.raiseTarget != null) {
            const inn = fig.raiseIn || 0;
            const tgt = fig.raiseTarget || 0;
            const toGo = Math.max(0, tgt - inn);
            let pace: string | null = null;
            if (fig.closeDate && toGo > 0) {
              const days = Math.max(1, Math.ceil((Date.parse(fig.closeDate + 'T12:00:00') - Date.now()) / 86400000));
              pace = money(toGo / Math.max(1, days / 7)) + ' a week';
            }
            desk.raise = Object.assign({}, desk.raise, {
              in: inn, target: tgt || null, inLabel: money(inn), targetLabel: tgt ? money(tgt) : null,
              toGoLabel: tgt ? money(toGo) : null, closeDate: fig.closeDate, pace,
            }) as never;
          }
          desk.connected = (fig.cash != null) as never;
          desk.note = 'Cash, raised and target are set with Edit figures. Burn comes from the monthly expenses list.' as never;
        }
        desk.expenses = list
          .map((e) => ({ name: e.name + (e.freq === 'y' ? ' (yearly / 12)' : ''), amount: Math.round((e.freq === 'y' ? e.amount / 12 : e.amount) * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);
      } catch (err) {
        fail('finance_expenses', err);
      }
    }
    return NextResponse.json({ locked: false, ...desk });
  } catch (err) {
    fail('finance_failed', err);
    return NextResponse.json({ error: 'Finance is unavailable.' }, { status: 503 });
  }
}

/**
 * POST { code } → checks the code on the server and sets a 15-minute signed httpOnly cookie.
 * POST { lock: true } → clears it. Wrong code → 403 { locked: true }.
 */
export async function POST(req: Request) {
  try {
    const gate = await financeSession();
    if ('error' in gate) return gate.error;
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    if (body.lock === true) {
      const res = NextResponse.json({ locked: true });
      res.cookies.set(FINANCE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
      return res;
    }
    // 5 code attempts per user per 15 minutes; a 4-digit code must not be guessable by brute force.
    if (gate.session.sql && !(await takeRateLimit(gate.session.sql, 'finance-unlock', gate.session.userId, 5, FINANCE_UNLOCK_SECONDS))) {
      return NextResponse.json({ locked: true, error: 'Too many tries. Wait 15 minutes.' }, { status: 429 });
    }
    if (!(await financeCodeOk(gate.session.sql, gate.ownerId, body.code))) {
      return NextResponse.json({ locked: true, error: 'That code did not match.' }, { status: 403 });
    }
    const value = financeUnlockValue(gate.session.userId);
    if (!value) return NextResponse.json({ error: 'Finance unlock is not configured.' }, { status: 503 });
    const res = NextResponse.json({ locked: false, unlockedUntil: Date.now() + FINANCE_UNLOCK_SECONDS * 1000 });
    res.cookies.set(FINANCE_COOKIE, value, { ...COOKIE_OPTIONS, maxAge: FINANCE_UNLOCK_SECONDS });
    return res;
  } catch (err) {
    fail('finance_unlock', err);
    return NextResponse.json({ error: 'Finance is unavailable.' }, { status: 503 });
  }
}
