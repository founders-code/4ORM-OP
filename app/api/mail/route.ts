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
    const messages = mail?.messages || [];
    for (const message of messages) {
      const email = String(message.email || '').trim();
      const at = Number(message.at);
      if (!email || !Number.isFinite(at)) continue;
      const iso = new Date(at).toISOString();
      try {
        await session.sql`
          UPDATE contacts SET last_touch = ${iso}::timestamptz
          WHERE owner_id = ${session.userId} AND lower(email) = lower(${email})
            AND (last_touch IS NULL OR last_touch < ${iso}::timestamptz)
        `;
      } catch (err) {
        fail('mail_touch', err);
      }
    }
    return NextResponse.json({ messages });
  } catch (err) {
    fail('mail_inbox', err);
    return NextResponse.json({ messages: [] });
  }
}
