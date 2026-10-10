import { NextResponse } from 'next/server';
import { signState } from '@/lib/oauth-state.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive',
].join(' ');

const HOSTS = new Set(['www.4ormop.com', '4ormop.com', '4orm-op.vercel.app', 'localhost:3000']);

export function requestOrigin(req: Request) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim().toLowerCase();
  if (!HOSTS.has(host)) return null;
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    const origin = requestOrigin(req);
    if (!session || !origin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const secret = process.env.CLERK_SECRET_KEY || '';
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !secret) {
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
