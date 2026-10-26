import { NextResponse } from 'next/server';
import { env } from '@/lib/env.mjs';
import { signState } from '@/lib/oauth-state.mjs';
import { fail } from '@/lib/log';
import { requestOrigin } from '@/lib/public-origin';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
].join(' ');

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    const origin = requestOrigin(req);
    if (!session || !origin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = env('GOOGLE_CLIENT_ID');
    const secret = process.env.CLERK_SECRET_KEY || '';
    if (!clientId || !env('GOOGLE_CLIENT_SECRET') || !secret) {
      return NextResponse.redirect(new URL('/control-room', origin));
    }
    const state = signState(session.userId, secret);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', `${origin}/api/connect/google/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return NextResponse.redirect(url);
  } catch {
    fail('connect_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
