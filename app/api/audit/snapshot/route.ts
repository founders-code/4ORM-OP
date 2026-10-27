import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { pacificDay, saveSnapshot } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const concerns: string[] = [];
    if (!process.env.OPENAI_API_KEY) concerns.push('OpenAI key is not set in Vercel');
    if (session.sql) {
      const day = pacificDay(new Date());
      await saveSnapshot(session.sql, session.userId, day).catch(() => {});
      await session.sql`INSERT INTO audit_runs (owner_id, concerns) VALUES (${ownerId}, ${JSON.stringify(concerns)}::jsonb)`.catch(() => {});
    }
    return NextResponse.json({ ok: true, concerns: concerns.slice(0, 3) });
  } catch (err) {
    fail('audit_snapshot', err);
    return NextResponse.json({ ok: false, concerns: [] }, { status: 500 });
  }
}
