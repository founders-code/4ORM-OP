import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { buildFlowMap } from '@/lib/flow-map';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* The process map: every source, receiver, store, page and outbound rail, each with a lamp from a real reading. */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(await buildFlowMap(session.sql, ownerId, session.userId));
  } catch (err) {
    fail('ops_map', err);
    return NextResponse.json({ nodes: [], edges: [], error: 'Map did not load' }, { status: 500 });
  }
}
