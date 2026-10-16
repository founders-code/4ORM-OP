import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { createReplyDraft, inboxMail, linkedinMail } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ messages: [], linkedin: [] });
    const creds = await loadCredsFor(session.userId);
    const [mail, linked] = await Promise.all([
      withCreds(creds, () => inboxMail()).catch((err) => { fail('mail_inbox', err); return null; }),
      withCreds(creds, () => linkedinMail()).catch((err) => { fail('mail_linkedin', err); return null; }),
    ]);
    const messages = mail?.messages || [];
    for (const message of messages) {
      const email = String(message.email || '').trim();
      const at = Number(message.at);
      if (!email || !Number.isFinite(at) || message.outbound) continue;
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
    return NextResponse.json({ messages, linkedin: linked?.items || [] });
  } catch (err) {
    fail('mail_inbox', err);
    return NextResponse.json({ messages: [], linkedin: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ saved: false });
    const creds = await loadCredsFor(session.userId);
    const id = await withCreds(creds, () => createReplyDraft({
      to: String(body.to || ''),
      subject: String(body.subject || ''),
      text: String(body.text || ''),
      threadId: String(body.threadId || ''),
      messageId: String(body.messageId || ''),
    }));
    return NextResponse.json({ saved: !!id });
  } catch (err) {
    fail('mail_reply', err);
    return NextResponse.json({ saved: false });
  }
}
