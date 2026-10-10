import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const raw = body?.runwayWeeks;
    let weeks: number | null = null;
    if (raw != null && raw !== '') {
      weeks = Number(raw);
      if (!Number.isInteger(weeks) || weeks < 0 || weeks > 520) {
        return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      }
    }
    await session.sql`
      INSERT INTO owner_settings (owner_id, runway_weeks)
      VALUES (${session.userId}, ${weeks})
      ON CONFLICT (owner_id) DO UPDATE SET runway_weeks = EXCLUDED.runway_weeks
    `;
    return NextResponse.json({ runwayWeeks: weeks });
  } catch {
    fail('settings_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
