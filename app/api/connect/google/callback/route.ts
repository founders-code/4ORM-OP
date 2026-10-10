import { NextResponse } from 'next/server';
import { readState } from '@/lib/oauth-state.mjs';
import { fail } from '@/lib/log';
import { requestOrigin } from '../route';
import { openBoard } from '@/lib/session';
import { saveGoogleRefresh } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const back = origin ? new URL('/control-room', origin) : null;
  try {
    if (!origin || !back) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await openBoard();
    const secret = process.env.CLERK_SECRET_KEY || '';
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    const stateUser = readState(url.searchParams.get('state') || '', secret);
    if (!session || !stateUser || stateUser !== session.userId || !code) {
      return NextResponse.redirect(back);
    }
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) return NextResponse.redirect(back);
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/connect/google/callback`,
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return NextResponse.redirect(back);
    const json = (await res.json()) as { refresh_token?: string };
    if (json.refresh_token) {
      const saved = await saveGoogleRefresh(session.userId, json.refresh_token);
      if (!saved) return NextResponse.redirect(back);
    }
    return NextResponse.redirect(back);
  } catch {
    fail('connect_failed');
    if (back) return NextResponse.redirect(back);
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
