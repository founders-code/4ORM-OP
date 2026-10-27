import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DIALS = [
  { key: 'api_latency', label: 'API latency', unit: 'ms', amber: 300, red: 450, note: 'p95 over 5 minutes' },
  { key: 'error_rate', label: 'Error rate', unit: '%', amber: 1, red: 2.5, note: '5 minute window' },
  { key: 'db_pool', label: 'Database pool', unit: 'of 40', amber: 28, red: 34, note: 'open connections' },
  { key: 'jobs_waiting', label: 'Jobs waiting', unit: '', amber: 15, red: 28, note: 'queue depth' },
  { key: 'sends_today', label: 'Sends today', unit: 'of 25', amber: 20, red: 24, note: 'rail count' },
  { key: 'ai_spend', label: 'AI spend', unit: 'of $25', amber: 18, red: 22, note: 'today' },
  { key: 'fn_load', label: 'Function load', unit: '%', amber: 70, red: 88, note: 'Vercel' },
  { key: 'fact_drift', label: 'Fact drift', unit: 'places', amber: 6, red: 14, note: 'out of date' },
];

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    let latest = new Map<string, number>();
    if (session.sql) {
      try {
        const rows = await session.sql`
          SELECT DISTINCT ON (key) key, value
          FROM ops_metrics
          ORDER BY key, taken_at DESC
        `;
        for (const r of rows || []) {
          if (r && r.key != null && r.value != null) latest.set(String(r.key), Number(r.value));
        }
      } catch {
        /* table may be empty */
      }
    }
    const dials = DIALS.map((d) => {
      const has = latest.has(d.key);
      const value = has ? latest.get(d.key) : null;
      return { ...d, value: value == null || Number.isNaN(value) ? null : value, note: has ? d.note : d.note + ' · no sample yet' };
    });
    return NextResponse.json({ dials, window: '5m' });
  } catch (err) {
    fail('ops_dials', err);
    return NextResponse.json({ dials: [] }, { status: 500 });
  }
}
