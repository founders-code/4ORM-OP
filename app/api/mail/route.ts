import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { inboxMail } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ messages: [] });
    const creds = await loadCredsFor(session.userId);
    const mail = await withCreds(creds, () => inboxMail());
    return NextResponse.json({ messages: mail?.messages || [] });
  } catch (err) {
    fail('mail_inbox', err);
    return NextResponse.json({ messages: [] });
  }
}
