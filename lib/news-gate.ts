import { NextResponse } from 'next/server';
import type { BoardSession } from './session';

/**
 * Shapes the openBoard() + sessionOwner() result for the News collection routes (each route calls both itself,
 * so scripts/secure.test.mjs can see the gate). 401 signed out, 403 not allowlisted, 503 no database.
 */
export function newsOwner(session: BoardSession | null, ownerId: string | null) {
  if (!session) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!ownerId) return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  if (!session.sql) return { res: NextResponse.json({ error: 'Database unavailable' }, { status: 503 }) } as const;
  return { sql: session.sql, ownerId } as const;
}
