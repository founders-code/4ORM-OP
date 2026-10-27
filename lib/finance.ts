import { createHmac } from 'crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env.mjs';
import { tokenOk } from './guard.mjs';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

/** Used only when owner_settings.finance_code and FINANCE_CODE are both unset. Never sent to the browser. */
const DEFAULT_CODE = '1313';

export const FINANCE_COOKIE = 'fin_ok';
export const FINANCE_UNLOCK_SECONDS = 15 * 60;
export const VAULT_COOKIE = 'vault_ok';

/** The owner's gate code: owner_settings.finance_code, else FINANCE_CODE, else the default. Server-side only. */
async function financeCode(sql: Sql | null, ownerId: string) {
  if (sql) {
    try {
      const rows = await sql`SELECT finance_code FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
      const stored = String(rows[0]?.finance_code || '').replace(/\D/g, '');
      if (stored) return stored;
    } catch (err) {
      fail('finance_code', err);
    }
  }
  return env('FINANCE_CODE').replace(/\D/g, '') || DEFAULT_CODE;
}

export async function financeCodeOk(sql: Sql | null, ownerId: string, presented: unknown) {
  const code = String(presented ?? '').replace(/\D/g, '');
  if (!code) return false;
  return tokenOk(code, await financeCode(sql, ownerId));
}

function cookieKey() {
  return env('FINANCE_COOKIE_SECRET') || env('CLERK_SECRET_KEY');
}

function sign(userId: string, expires: number) {
  const key = cookieKey();
  if (!key) return '';
  return createHmac('sha256', key).update(`fin:${userId}:${expires}`).digest('base64url');
}

/** Short-lived signed unlock value bound to the Clerk user id: `<expiresMs>.<hmac>`. '' when no key is configured. */
export function financeUnlockValue(userId: string, now = Date.now()) {
  const expires = now + FINANCE_UNLOCK_SECONDS * 1000;
  const mac = sign(userId, expires);
  return mac ? `${expires}.${mac}` : '';
}

export function financeUnlocked(value: string | undefined, userId: string, now = Date.now()) {
  const [rawExpires, mac] = String(value || '').split('.');
  const expires = Number(rawExpires);
  if (!mac || !Number.isFinite(expires) || expires <= now) return false;
  const expected = sign(userId, expires);
  return !!expected && tokenOk(mac, expected);
}

function vaultSign(userId: string) {
  const key = cookieKey();
  if (!key) return '';
  return createHmac('sha256', key).update(`vault:${userId}:session`).digest('base64url');
}

export function vaultUnlockValue(userId: string) {
  const mac = vaultSign(userId);
  return mac ? `session.${mac}` : '';
}

export function vaultUnlocked(value: string | undefined, userId: string) {
  const [kind, mac] = String(value || '').split('.');
  if (kind !== 'session' || !mac) return false;
  const expected = vaultSign(userId);
  return !!expected && tokenOk(mac, expected);
}

/**
 * Finance desk numbers. The master finance sheet is not connected yet, so every figure is null and every
 * list is empty; the client shows "Fills in from the master finance sheet once it's connected".
 * No sample or fallback numbers are ever served.
 */
/** Link to the master finance sheet: env FINANCE_SHEET_URL, https only. '' when not configured. */
export function financeSheetUrl() {
  const raw = env('FINANCE_SHEET_URL').trim();
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/**
 * The approved financial model (28 Sep 2026), BUILD_RULES section 4: 2031 revenue projections, not results.
 * These are model outputs, separate from the master finance sheet numbers above.
 */
export const FINANCE_MODEL = {
  date: '28 Sep 2026',
  metric: '2031 revenue',
  scenarios: [
    { name: 'Ground Floor', value: 'C$10.5M', locked: false },
    { name: 'Base', value: 'C$94.7M', locked: true },
    { name: 'Blue Sky', value: 'C$260.6M', locked: false },
  ],
};

export function financeDesk() {
  return {
    sheetUrl: financeSheetUrl(),
    model: FINANCE_MODEL,
    connected: false,
    note: 'Fills in from the master finance sheet once it is connected.',
    asOf: null,
    cash: null,
    cashLabel: null,
    burnMonthly: null,
    burnLabel: null,
    runwayDays: null,
    runwayLabel: null,
    raise: {
      in: null,
      pending: null,
      open: null,
      target: null,
      pace: null,
      inLabel: null,
      targetLabel: null,
      toGoLabel: null,
      chunks: null,
      closeDate: null,
    },
    cheques: [] as Array<{ label: string; state: string }>,
    expenses: [] as Array<{ name: string; amount: number }>,
    scenarios: [] as Array<{ name: string; line: string }>,
  };
}
