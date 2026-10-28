import type { Sql } from './db';
import { fail } from './log';

/** One recurring bill. freq 'm' = every month on `day`; 'y' = once a year on `day` of `month` (1-12). */
export type Expense = { id: string; name: string; freq: 'm' | 'y'; day: number; month: number | null; amount: number; note: string };

/** Seeded once per owner from the SaaS OPEX tab of the master finance tracker (8 Apr 2026, V3). */
const SEED: Array<[string, 'm' | 'y', number, number | null, number]> = [
  ['Corp Zoom', 'y', 1, 4, 19.16],
  ['GoDaddy domain', 'y', 5, 7, 1.9],
  ['GoDaddy domain', 'y', 5, 7, 1.9],
  ['GoDaddy Domains', 'y', 5, 7, 2.47],
  ['GoDaddy 4ormfinance.com', 'y', 10, 10, 0.99],
  ['Proton company email', 'm', 16, null, 21.32],
  ['Cursor AI', 'm', 19, null, 30.72],
  ['Google Workspace (5 users)', 'm', 20, null, 55],
  ['Gamma AI', 'm', 23, null, 35.57],
  ['Open Sign Labs', 'm', 25, null, 27.29],
  ['Eleven Labs', 'y', 25, 3, 35],
  ['Claude AI', 'm', 26, null, 313.6],
  ['LinkedIn', 'm', 27, null, 133.32],
  ['ChatGPT', 'm', 27, null, 144.54],
  ['Parallel', 'm', 27, null, 80],
  ['Exa', 'm', 27, null, 40],
  ['Vercel', 'm', 27, null, 20],
  ['Clerk', 'm', 27, null, 28],
];

export async function ensureExpenses(sql: Sql, ownerId: string) {
  await sql`CREATE TABLE IF NOT EXISTS saas_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    name text NOT NULL,
    freq text NOT NULL DEFAULT 'm',
    day int NOT NULL DEFAULT 1,
    month int,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    note text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS saas_expenses_seeded (owner_id text PRIMARY KEY, seeded_at timestamptz NOT NULL DEFAULT now())`;
  const seeded = await sql`SELECT 1 FROM saas_expenses_seeded WHERE owner_id = ${ownerId} LIMIT 1`;
  if (seeded.length) return;
  for (const [name, freq, day, month, amount] of SEED) {
    await sql`INSERT INTO saas_expenses (owner_id, name, freq, day, month, amount, note)
      VALUES (${ownerId}, ${name}, ${freq}, ${day}, ${month}, ${amount}, 'From the finance tracker, SaaS OPEX')`;
  }
  await sql`INSERT INTO saas_expenses_seeded (owner_id) VALUES (${ownerId}) ON CONFLICT DO NOTHING`;
}

export async function listExpenses(sql: Sql, ownerId: string): Promise<Expense[]> {
  await ensureExpenses(sql, ownerId);
  const rows = await sql`SELECT id, name, freq, day, month, amount, note FROM saas_expenses
    WHERE owner_id = ${ownerId} AND active ORDER BY amount DESC, name`;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    freq: r.freq === 'y' ? 'y' : 'm',
    day: Number(r.day) || 1,
    month: r.month == null ? null : Number(r.month),
    amount: Number(r.amount) || 0,
    note: r.note ? String(r.note) : '',
  }));
}

/** Clean an incoming expense. Returns null when it cannot be saved. */
export function cleanExpense(b: Record<string, unknown>) {
  const name = String(b.name || '').trim().slice(0, 120);
  const freq = b.freq === 'y' ? 'y' : 'm';
  const day = Math.round(Number(b.day));
  const month = b.month == null || b.month === '' ? null : Math.round(Number(b.month));
  const amount = Math.round(Number(b.amount) * 100) / 100;
  if (!name || !Number.isFinite(day) || day < 1 || day > 31 || !Number.isFinite(amount) || amount < 0 || amount > 1e6) return null;
  if (freq === 'y' && (month == null || !Number.isFinite(month) || month < 1 || month > 12)) return null;
  return { name, freq, day, month: freq === 'y' ? month : null, amount, note: String(b.note || '').slice(0, 300) };
}

function vanToday() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: g('year'), m: g('month'), d: g('day') };
}

/** Month view of spend: what is billed this month, what has already come out, and the AI estimate. */
export async function spendSummary(sql: Sql, ownerId: string, list: Expense[]) {
  const t = vanToday();
  const dueThisMonth = list.filter((e) => e.freq === 'm' || e.month === t.m);
  const monthTotal = round(dueThisMonth.reduce((a, e) => a + e.amount, 0));
  const soFar = round(dueThisMonth.filter((e) => e.day <= t.d).reduce((a, e) => a + e.amount, 0));
  const monthly = round(list.filter((e) => e.freq === 'm').reduce((a, e) => a + e.amount, 0));
  const yearly = round(list.filter((e) => e.freq === 'y').reduce((a, e) => a + e.amount, 0));
  let aiCalls = 0;
  try {
    const start = `${t.y}-${String(t.m).padStart(2, '0')}-01`;
    const r = await sql`SELECT coalesce(sum(calls),0)::int AS n FROM vendor_budget
      WHERE vendor IN ('openai','anthropic') AND window_start >= ${start}::date`;
    aiCalls = Number(r[0]?.n) || 0;
  } catch (err) {
    fail('spend_ai_calls', err);
  }
  return {
    month: t.m,
    year: t.y,
    monthTotal,
    soFar,
    paymentsThisMonth: dueThisMonth.length,
    monthly,
    yearly,
    annual: round(monthly * 12 + yearly),
    aiCalls,
    aiEstimate: round(aiCalls * 0.02),
    neon: await neonUsage(),
  };
}

/** Neon compute hours this billing period. Needs NEON_API_KEY (and NEON_PROJECT_ID, which the Vercel integration sets). */
async function neonUsage() {
  const key = process.env.NEON_API_KEY || '';
  const project = process.env.NEON_PROJECT_ID || '';
  if (!key || !project) return { connected: false as const };
  try {
    const r = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(project)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!r.ok) return { connected: false as const, error: `Neon answered ${r.status}` };
    const j = (await r.json()) as { project?: Record<string, unknown> };
    const p = j.project || {};
    const cuSeconds = Number(p.compute_time_seconds) || 0;
    const activeSeconds = Number(p.active_time_seconds) || 0;
    return {
      connected: true as const,
      computeHours: round(cuSeconds / 3600),
      activeHours: round(activeSeconds / 3600),
      periodStart: String(p.consumption_period_start || ''),
      storageMb: round((Number(p.synthetic_storage_size) || 0) / 1048576),
    };
  } catch (err) {
    fail('spend_neon', err);
    return { connected: false as const, error: 'Neon could not be reached' };
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
