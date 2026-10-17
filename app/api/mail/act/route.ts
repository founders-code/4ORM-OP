import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { gmailModify, gmailSend } from '@/lib/google';
import { fail } from '@/lib/log';
import { ensureMailBoard, fileMessage, saveRule } from '@/lib/mail-board';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ ok: false });
    await ensureMailBoard(session.sql);
    const action = String(body.action || '');
    const id = String(body.id || '');
    const creds = await loadCredsFor(session.userId);
    if (action === 'move') {
      const column = String(body.column || '');
      const ok = await fileMessage(session.sql, session.userId, id, column);
      if (body.sticky && body.email) {
        await saveRule(session.sql, session.userId, {
          matchType: String(body.matchType || 'sender'),
          matchValue: String(body.email || ''),
          target: column,
          sticky: true,
        });
      }
      return NextResponse.json({ ok });
    }
    if (action === 'reply' || action === 'compose') {
      const sent = await withCreds(creds, () => gmailSend({
        to: String(body.to || ''),
        subject: String(body.subject || ''),
        text: String(body.text || ''),
        threadId: String(body.threadId || ''),
        messageId: String(body.messageId || ''),
        reply: action === 'reply',
      }));
      return NextResponse.json({ ok: sent.ok, drafted: sent.drafted, status: sent.status });
    }
    if (action === 'archive') {
      const sent = await withCreds(creds, () => gmailModify(id, [], ['INBOX']));
      return NextResponse.json({ ok: sent.ok, status: sent.status });
    }
    if (action === 'done') {
      const sent = await withCreds(creds, () => gmailModify(id, [], ['INBOX', 'UNREAD']));
      return NextResponse.json({ ok: sent.ok, status: sent.status });
    }
    if (action === 'read') {
      const sent = await withCreds(creds, () => gmailModify(id, [], ['UNREAD']));
      return NextResponse.json({ ok: sent.ok, status: sent.status });
    }
    if (action === 'unread') {
      const sent = await withCreds(creds, () => gmailModify(id, ['UNREAD'], []));
      return NextResponse.json({ ok: sent.ok, status: sent.status });
    }
    if (action === 'snooze') {
      const hours = Math.min(72, Math.max(1, Number(body.hours) || 24));
      const until = new Date(Date.now() + hours * 3600000).toISOString();
      try {
        await session.sql`
          INSERT INTO email_snooze (owner_id, message_id, until)
          VALUES (${session.userId}, ${id}, ${until}::timestamptz)
          ON CONFLICT (owner_id, message_id) DO UPDATE SET until = EXCLUDED.until
        `;
      } catch (err) {
        fail('mail_snooze', err);
      }
      const sent = await withCreds(creds, () => gmailModify(id, [], ['INBOX']));
      return NextResponse.json({ ok: sent.ok, status: sent.status, until });
    }
    return NextResponse.json({ ok: false });
  } catch (err) {
    fail('mail_act', err);
    return NextResponse.json({ ok: false });
  }
}
