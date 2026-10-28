import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cleanExpense, ensureExpenses, listExpenses, spendSummary } from '@/lib/expenses';
import { FINANCE_COOKIE, financeUnlocked } from '@/lib/finance';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** The expenses list sits behind the same Financials code (the fin_ok cookie is scoped to /api/finance). */
async function gate() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!financeUnlocked(cookies().get(FINANCE_COOKIE)?.value, session.userId)) {
    return { error: NextResponse.json({ locked: true }, { status: 403 }) };
  }
  if (!session.sql) return { error: NextResponse.json({ error: 'Database unavailable' }, { status: 503 }) };
  return { sql: session.sql, ownerId };
}

export async function GET() {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const expenses = await listExpenses(g.sql, g.ownerId);
    const spend = await spendSummary(g.sql, g.ownerId, expenses);
    return NextResponse.json({ expenses, spend });
  } catch (err) {
    fail('expenses_get', err);
    return NextResponse.json({ error: 'Expenses are unavailable.' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const e = cleanExpense(((await req.json().catch(() => null)) || {}) as Record<string, unknown>);
    if (!e) return NextResponse.json({ error: 'Name, day and amount are needed (and the month for a yearly bill).' }, { status: 400 });
    await ensureExpenses(g.sql, g.ownerId);
    const rows = await g.sql`INSERT INTO saas_expenses (owner_id, name, freq, day, month, amount, note)
      VALUES (${g.ownerId}, ${e.name}, ${e.freq}, ${e.day}, ${e.month}, ${e.amount}, ${e.note}) RETURNING id`;
    return NextResponse.json({ id: String(rows[0]?.id || '') });
  } catch (err) {
    fail('expenses_post', err);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const b = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const id = String(b.id || '');
    const e = cleanExpense(b);
    if (!id || !e) return NextResponse.json({ error: 'Name, day and amount are needed (and the month for a yearly bill).' }, { status: 400 });
    await g.sql`UPDATE saas_expenses SET name = ${e.name}, freq = ${e.freq}, day = ${e.day}, month = ${e.month},
      amount = ${e.amount}, note = ${e.note}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${g.ownerId}`;
    return NextResponse.json({ saved: true });
  } catch (err) {
    fail('expenses_patch', err);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
}

/** Soft delete; { id, restore: true } brings it back (Undo). */
export async function DELETE(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const b = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const id = String(b.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const active = b.restore === true;
    await g.sql`UPDATE saas_expenses SET active = ${active}, updated_at = now() WHERE id = ${id}::uuid AND owner_id = ${g.ownerId}`;
    return NextResponse.json({ saved: true, active });
  } catch (err) {
    fail('expenses_delete', err);
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  }
}
