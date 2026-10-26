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
    return NextResponse.json({ locked: false, ...financeDesk() });
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
