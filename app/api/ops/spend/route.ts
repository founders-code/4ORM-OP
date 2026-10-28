import { NextResponse } from 'next/server';
import { listExpenses, spendSummary } from '@/lib/expenses';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Pay-per-use services: the bill depends on how much the site does, so they are not on the SaaS sheet as a fixed amount. */
const USAGE = [
  { name: 'Neon database', what: 'Compute hours and storage for every page of the ops site', basis: 'Per use' },
  { name: 'Anthropic API', what: 'Briefs, drafts, rewrites and research inside the ops site', basis: 'Per use' },
  { name: 'OpenAI API', what: 'Transcription for Recordings and the voice log', basis: 'Per use' },
];

/** Control room spend list: every recurring bill from the SaaS sheet plus the pay-per-use services and this month's reading. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ rows: [], reason: 'no database url' });
    const list = await listExpenses(session.sql, ownerId);
    const s = await spendSummary(session.sql, ownerId, list);
    const rows = list.map((e) => ({
      name: e.name,
      basis: e.freq === 'm' ? 'Monthly' : 'Yearly',
      source: 'SaaS sheet',
      amount: e.amount,
      when: e.freq === 'm' ? `the ${e.day}${ord(e.day)}` : `${MONTHS[(e.month || 1) - 1]} ${e.day}`,
      reading:
        e.freq === 'y' && e.month !== s.month
          ? 'not this month'
          : e.day <= vanDay()
            ? 'paid this month'
            : `due the ${e.day}${ord(e.day)}`,
    }));
    const neon = s.neon as { connected?: boolean; computeHours?: number };
    const usage = USAGE.map((u) => {
      let reading = '';
      if (u.name === 'Neon database') reading = neon && neon.connected ? `${neon.computeHours} compute hours this period` : 'add NEON_API_KEY in Vercel to read hours';
      if (u.name === 'Anthropic API' || u.name === 'OpenAI API') reading = `${s.aiCalls} AI calls this month, about $${s.aiEstimate.toFixed(2)} for both`;
      return { name: u.name, basis: u.basis, source: 'Billed by use', amount: null, when: 'monthly invoice', what: u.what, reading };
    });
    return NextResponse.json({ rows: [...rows, ...usage], monthTotal: s.monthTotal, monthly: s.monthly, yearly: s.yearly, soFar: s.soFar });
  } catch (err) {
    fail('ops_spend', err);
    return NextResponse.json({ rows: [] }, { status: 500 });
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ord(n: number) {
  const t = n % 100;
  if (t > 10 && t < 14) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';
}

function vanDay() {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', day: '2-digit' }).format(new Date()));
}
