import type { Sql } from './db';

/* The four numbers Chad keeps current by hand (cash in the bank, raised so far, raise target, close date).
   Burn comes from the monthly expenses list; runway and pace are worked out from these. */
export type Figures = { cash: number | null; raiseIn: number | null; raiseTarget: number | null; closeDate: string | null; updatedAt: string | null };

export async function ensureFigures(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS finance_figures (
    owner_id text PRIMARY KEY,
    cash numeric(14,2),
    raise_in numeric(14,2),
    raise_target numeric(14,2),
    close_date date,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
}

export async function getFigures(sql: Sql, ownerId: string): Promise<Figures> {
  await ensureFigures(sql);
  const r = (await sql`SELECT cash, raise_in, raise_target, close_date, updated_at FROM finance_figures WHERE owner_id = ${ownerId} LIMIT 1`)[0] as Record<string, unknown> | undefined;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    cash: r ? n(r.cash) : null,
    raiseIn: r ? n(r.raise_in) : null,
    raiseTarget: r ? n(r.raise_target) : null,
    closeDate: r && r.close_date ? new Date(String(r.close_date)).toISOString().slice(0, 10) : null,
    updatedAt: r && r.updated_at ? new Date(String(r.updated_at)).toISOString() : null,
  };
}

function num(v: unknown) {
  if (v === '' || v == null) return null;
  const x = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(x) && x >= 0 && x < 1e12 ? Math.round(x * 100) / 100 : undefined;
}

export async function setFigures(sql: Sql, ownerId: string, body: Record<string, unknown>) {
  const cash = num(body.cash);
  const raiseIn = num(body.raiseIn);
  const raiseTarget = num(body.raiseTarget);
  const cd = body.closeDate == null || body.closeDate === '' ? null : String(body.closeDate);
  if (cash === undefined || raiseIn === undefined || raiseTarget === undefined || (cd && !/^\d{4}-\d{2}-\d{2}$/.test(cd))) {
    return { error: 'Use plain numbers for the amounts and YYYY-MM-DD for the close date.' };
  }
  await ensureFigures(sql);
  await sql`INSERT INTO finance_figures (owner_id, cash, raise_in, raise_target, close_date, updated_at)
    VALUES (${ownerId}, ${cash}, ${raiseIn}, ${raiseTarget}, ${cd}, now())
    ON CONFLICT (owner_id) DO UPDATE SET cash = EXCLUDED.cash, raise_in = EXCLUDED.raise_in,
      raise_target = EXCLUDED.raise_target, close_date = EXCLUDED.close_date, updated_at = now()`;
  return { saved: true };
}
