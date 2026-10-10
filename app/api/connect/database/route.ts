import { NextResponse } from 'next/server';
import { getSql, resetSql } from '@/lib/db';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { rememberDatabaseUrl, saveDatabaseUrl } from '@/lib/vault';

export const dynamic = 'force-dynamic';

function connectionString(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 500 || /[\r\n\s]/.test(raw)) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return '';
    if (!url.hostname || !url.username) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const connection = connectionString(body?.connection);
    if (!connection) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const saved = await saveDatabaseUrl(session.userId, connection);
    if (!saved) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    rememberDatabaseUrl(connection);
    resetSql();
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    return NextResponse.json({ saved: true });
  } catch {
    fail('connect_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
