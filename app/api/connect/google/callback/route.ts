import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { env } from '@/lib/env.mjs';
import { ensureWatches } from '@/lib/live';
import { fail } from '@/lib/log';
import { readState } from '@/lib/oauth-state.mjs';
import { requestOrigin } from '@/lib/public-origin';
import { openBoard, roomOwner, sessionOwner } from '@/lib/session';
import { loadCredsFor, saveGoogleRefresh } from '@/lib/vault';

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
    // Only an allowlisted user may store Google access for the room.
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = env('GOOGLE_CLIENT_ID');
    const clientSecret = env('GOOGLE_CLIENT_SECRET');
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
    if (!res.ok) {
      console.error('google_token', res.status, await res.text());
      return NextResponse.redirect(back);
    }
    const json = (await res.json()) as { refresh_token?: string };
    if (json.refresh_token) {
      const saved = await saveGoogleRefresh(session.userId, json.refresh_token);
      if (!saved) return NextResponse.redirect(back);
    }
    try {
      if (session.sql) {
        const ownerId = (await roomOwner(session.sql)) || session.userId;
        const creds = await loadCredsFor(session.userId);
        await withCreds(creds, () => ensureWatches(session.sql!, ownerId, origin));
      }
    } catch (err) {
      fail('connect_watch', err);
    }
    return NextResponse.redirect(back);
  } catch {
    fail('connect_failed');
    if (back) return NextResponse.redirect(back);
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
