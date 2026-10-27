import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ samples: [], reason: 'no database url' });
    const url = new URL(req.url);
    const key = String(url.searchParams.get('key') || '');
    const rows = key
      ? await session.sql`SELECT key, value, taken_at FROM ops_metrics WHERE key = ${key} ORDER BY taken_at DESC LIMIT 120`
      : await session.sql`SELECT key, value, taken_at FROM ops_metrics ORDER BY taken_at DESC LIMIT 400`;
    return NextResponse.json({
      samples: rows || [],
      reason: !rows || !rows.length ? 'no sample yet' : '',
    });
  } catch (err) {
    fail('ops_metrics_get', err);
    return NextResponse.json({ samples: [], reason: 'metrics unavailable' }, { status: 500 });
  }
}
