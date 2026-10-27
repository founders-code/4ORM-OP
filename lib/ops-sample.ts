import type { Sql } from './db';
import { fail } from './log';
import { outbound, recordCall, tape } from './outbound';

const DIAL_KEYS = [
  'api_latency',
  'error_rate',
  'db_pool',
  'jobs_waiting',
  'sends_today',
  'ai_spend',
  'fn_load',
  'fact_drift',
] as const;

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function pingKnown() {
  await outbound('https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
}

export async function sampleOpsDials(sql: Sql) {
  const t0 = Date.now();
  try {
    const neonT0 = Date.now();
    await sql`SELECT 1`;
    await recordCall('neon', 'SELECT 1', 200, Date.now() - neonT0);
    await pingKnown();

    const calls = await sql`
      SELECT ms, code FROM api_calls WHERE at > now() - interval '5 minutes'
    `;
    const mss = (calls || []).map((r) => num(r.ms)).filter((n) => n >= 0).sort((a, b) => a - b);
    const p95 = mss.length ? mss[Math.min(mss.length - 1, Math.floor(mss.length * 0.95))] : 0;
    const errs = (calls || []).filter((r) => !r.code || Number(r.code) >= 400).length;
    const errorRate = mss.length ? (errs / mss.length) * 100 : 0;

    let pool = 1;
    try {
      const rows = await sql`SELECT count(*)::int AS n FROM pg_stat_activity`;
      pool = num(rows[0]?.n) || 1;
    } catch {
      pool = 1;
    }

    let waiting = 0;
    try {
      const mail = await sql`SELECT count(*)::int AS n FROM scheduled_mail WHERE status IN ('queued', 'pending')`;
      waiting += num(mail[0]?.n);
    } catch { /* table may not exist */ }
    try {
      const items = await sql`SELECT count(*)::int AS n FROM items WHERE status IN ('new', 'doing', 'open')`;
      waiting += num(items[0]?.n);
    } catch { /* ignore */ }

    let sends = 0;
    try {
      const rows = await sql`
        SELECT count(*)::int AS n FROM scheduled_mail
        WHERE status = 'sent' AND updated_at >= (timezone('America/Vancouver', now()))::date
      `;
      sends = num(rows[0]?.n);
    } catch { /* ignore */ }

    const elapsed = Date.now() - t0;
    const fnLoad = Math.min(100, (elapsed / 60000) * 100);
    const values: Record<(typeof DIAL_KEYS)[number], number> = {
      api_latency: p95,
      error_rate: Math.round(errorRate * 100) / 100,
      db_pool: pool,
      jobs_waiting: waiting,
      sends_today: sends,
      ai_spend: 0,
      fn_load: Math.round(fnLoad * 100) / 100,
      fact_drift: 0,
    };
    for (const key of DIAL_KEYS) {
      await sql`INSERT INTO ops_metrics (key, value) VALUES (${key}, ${values[key]})`;
    }
    await tape('ok', 'cron', `dials sampled · p95 ${p95} ms · ${mss.length} calls`);
    return values;
  } catch (err) {
    fail('ops_sample', err);
    await tape('err', 'cron', 'dial sample failed');
    return null;
  }
}
