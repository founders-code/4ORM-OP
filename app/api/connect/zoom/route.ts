import { NextResponse } from 'next/server';
import { env } from '@/lib/env.mjs';
import { signState } from '@/lib/oauth-state.mjs';
import { fail } from '@/lib/log';
import { requestOrigin } from '@/lib/public-origin';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Sign in to Zoom once so 4ormop can read My Notes (transcripts and AI notes). */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    const origin = requestOrigin(req);
    if (!session || !origin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = env('ZOOM_OAUTH_CLIENT_ID');
    const secret = process.env.CLERK_SECRET_KEY || '';
    if (!clientId || !env('ZOOM_OAUTH_CLIENT_SECRET') || !secret) {
      return NextResponse.json({ error: 'Zoom sign-in is not set up: ZOOM_OAUTH_CLIENT_ID and ZOOM_OAUTH_CLIENT_SECRET are missing in Vercel.' }, { status: 400 });
    }
    const url = new URL('https://zoom.us/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', `${origin}/api/connect/zoom/callback`);
    url.searchParams.set('state', signState(session.userId, secret));
    return NextResponse.redirect(url);
  } catch {
    fail('zoom_connect_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
