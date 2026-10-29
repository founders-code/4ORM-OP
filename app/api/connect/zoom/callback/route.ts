import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { readState } from '@/lib/oauth-state.mjs';
import { requestOrigin } from '@/lib/public-origin';
import { openBoard, roomOwner, sessionOwner } from '@/lib/session';
import { connectZoomNotes, notesError } from '@/lib/zoom-notes-user';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const back = origin ? new URL('/zoom', origin) : null;
  try {
    if (!origin || !back) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await openBoard();
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    const stateUser = readState(url.searchParams.get('state') || '', process.env.CLERK_SECRET_KEY || '');
    if (!session || !stateUser || stateUser !== session.userId || !code) return NextResponse.redirect(back);
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.redirect(back);
    const ownerId = (await roomOwner(session.sql)) || session.userId;
    const ok = await connectZoomNotes(session.sql, ownerId, code, `${origin}/api/connect/zoom/callback`);
    back.searchParams.set('zoom', ok ? 'connected' : `failed: ${notesError}`);
    return NextResponse.redirect(back);
  } catch (err) {
    fail('zoom_connect_callback', err);
    if (back) return NextResponse.redirect(back);
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
