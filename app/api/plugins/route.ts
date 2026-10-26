import { NextResponse } from 'next/server';
import { listPlugins } from '@/lib/plugins';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const syncRows = await session.sql`
      SELECT source, status FROM sync_state WHERE owner_id = ${session.userId}
    `;
    const sync = new Map<string, string>();
    for (const row of syncRows as Array<{ source: string; status: string }>) sync.set(String(row.source), String(row.status || ''));
    return NextResponse.json({ plugins: await listPlugins(session.sql, session.userId, sync) });
  } catch {
    fail('plugins_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
