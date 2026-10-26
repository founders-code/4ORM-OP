import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { saveGhl } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => null);
    const key = String(body?.key || '').trim();
    const location = String(body?.location || '').trim();
    if (key.length < 10 || key.length > 400 || /[\r\n]/.test(key) || !/^[A-Za-z0-9]{6,80}$/.test(location)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const saved = await saveGhl(session.userId, key, location);
    if (!saved) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    return NextResponse.json({ saved: true });
  } catch {
    fail('connect_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
