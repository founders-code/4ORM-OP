import type { NeonQueryFunction } from '@neondatabase/serverless';
import { loadCeoFiles } from './ceo';
import { readProfileFacts, SEED_FACTS } from './ceo-score.mjs';
import { fail } from './log';

type Sql = NeonQueryFunction<false, false>;

const DEFAULT_CODE = '1313';

const EXPENSES = [
  { name: 'Speer build', amount: 40000 },
  { name: 'Team and contractors', amount: 22862 },
  { name: 'Legal / regulatory / security / audit', amount: 15900 },
  { name: 'Running the company', amount: 11288 },
];

const CHEQUES = [
  { label: 'In', state: 'in' },
  { label: 'In', state: 'in' },
  { label: '$80K', state: 'in' },
  { label: 'Pend', state: 'pend' },
  { label: '5', state: 'open' },
  { label: '6', state: 'open' },
  { label: '7', state: 'open' },
];

function dollars(n: number) {
  return `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

function burnBreakdown(text: string) {
  const chunk = String(text || '').match(/Breakdown:\s*([^\n]+)/);
  if (!chunk) return EXPENSES.slice();
  const rows: Array<{ name: string; amount: number }> = [];
  for (const part of chunk[1].split(';')) {
    const m = part.trim().match(/^(.*?)\s*\$([0-9,]+)/);
    if (!m) continue;
    const amount = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(amount)) continue;
    rows.push({ name: m[1].replace(/\(.*$/, '').trim(), amount });
  }
  return rows.length ? rows : EXPENSES.slice();
}

function janBurn(text: string) {
  const m = String(text || '').match(/Burn steps up to\s*~?\$([0-9,]+)\/month from Jan 2027/i);
  const n = m ? Number(m[1].replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? n : 228016;
}

function trough(text: string) {
  const m = String(text || '').match(/low of \$([0-9,]+) in Aug 2027/i);
  const n = m ? Number(m[1].replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? n : 15622;
}

function openingAssumed(text: string) {
  const m = String(text || '').match(/model's \$([0-9,]+) opening assumption/i);
  const n = m ? Number(m[1].replace(/,/g, '')) : NaN;
  return Number.isFinite(n) ? n : 25000;
}

export async function financeDesk(sql: Sql | null, ownerId: string) {
  let code = DEFAULT_CODE;
  if (sql) {
    try {
      const rows = await sql`SELECT finance_code FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
      const stored = String(rows[0]?.finance_code || '').replace(/\D/g, '');
      if (stored) code = stored;
    } catch (err) {
      fail('finance_code', err);
    }
  }
  let profile = '';
  try {
    const files = loadCeoFiles();
    profile = files.profile || '';
  } catch (err) {
    fail('finance_profile', err);
  }
  const parsed = profile ? readProfileFacts(profile) : null;
  const cash = Number(parsed?.cash ?? SEED_FACTS.cash) || 100;
  const burn = Number(parsed?.burnMonthly ?? SEED_FACTS.burnMonthly) || 90050;
  const runwayDays = burn > 0 ? Math.max(0, Math.round((cash / burn) * 30)) : 1;
  const expenses = burnBreakdown(profile);
  const assumed = openingAssumed(profile);
  const jan = janBurn(profile);
  const floor = trough(profile);
  return {
    code,
    asOf: '12 Oct 2026',
    cash,
    cashLabel: dollars(cash),
    burnMonthly: burn,
    burnLabel: `~${dollars(burn)}/mo`,
    runwayDays,
    runwayLabel: runwayDays <= 1 ? '~1 day' : `~${runwayDays} days`,
    raise: {
      in: 80000,
      pending: 0,
      open: 170000,
      target: 250000,
      pace: 'behind',
      inLabel: '$80K',
      targetLabel: '$250K',
      toGoLabel: '$170K',
      chunks: '3/7',
    },
    cheques: CHEQUES,
    expenses,
    scenarios: [
      {
        name: 'Ground Floor',
        line: `Desk now. Cash ${dollars(cash)}. Burn ~${dollars(burn)}/mo. Runway ~1 day. Friends & family ${dollars(80000)} of ${dollars(250000)}.`,
      },
      {
        name: 'Base',
        line: `Model Oct-Dec path. Opening assumed ${dollars(assumed)}. Burn ~${dollars(burn)}/mo through Dec. Trough ${dollars(floor)} in Aug 2027 if every tranche lands.`,
      },
      {
        name: 'Blue Sky',
        line: `Jan 2027 go-to-market ramp. Burn steps to ~${dollars(jan)}/mo when GTM and the full team begin. Pre-seed model is $3M at $10M pre-money.`,
      },
    ],
  };
}
