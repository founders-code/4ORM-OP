import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { driveFileBytes, gmailModify, gmailSend, gmailTrash, type MailFile } from '@/lib/google';
import { fail } from '@/lib/log';
import { ensureMailBoard, fileMessage, saveRule } from '@/lib/mail-board';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Gmail is read with the room's Google credentials: only the allowlisted owner (see sessionOwner) may use it.
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ ok: false }, { status: session.sql ? 400 : 503 });
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
      return NextResponse.json({ ok }, ok ? undefined : { status: 404 });
    }
    if (action === 'trash' || action === 'untrash') {
      const sent = await withCreds(creds, () => gmailTrash(id, action === 'untrash'));
      return NextResponse.json({ ok: sent.ok, status: sent.status }, sent.ok ? undefined : { status: 502 });
    }
    if (action === 'reply' || action === 'compose') {
      // Real attachments: Drive files are fetched here with the room's Google credentials; uploaded files arrive as base64.
      const list = Array.isArray(body.attachments) ? (body.attachments as Array<Record<string, unknown>>).slice(0, 12) : [];
      const files: MailFile[] = [];
      const missed: string[] = [];
      let total = 0;
      for (const a of list) {
        const name = String(a.name || 'File').slice(0, 180);
        const driveId = String(a.driveFileId || '');
        const stagedId = String(a.stagedId || '');
        let file: MailFile | null = null;
        if (/^[0-9a-f-]{36}$/i.test(stagedId)) {
          // A file stored in the Documents library (bytes in staged_docs), owner-scoped.
          try {
            const rows = await session.sql`SELECT name, mime, body_b64 FROM staged_docs WHERE id = ${stagedId} AND owner_id = ${session.userId} LIMIT 1`;
            const row = rows[0] as { name?: string; mime?: string; body_b64?: string } | undefined;
            const bytes = row?.body_b64 ? Buffer.from(String(row.body_b64), 'base64') : null;
            if (bytes && bytes.length) file = { name: String(row?.name || name), type: String(row?.mime || 'application/octet-stream'), bytes };
          } catch (err) {
            fail('mail_att_staged', err);
          }
        } else if (/^[\w-]{8,200}$/.test(driveId)) {
          file = await withCreds(creds, () => driveFileBytes(driveId)).catch(() => null);
        } else if (typeof a.data === 'string' && a.data.length) {
          const bytes = Buffer.from(String(a.data).replace(/^data:[^,]*,/, ''), 'base64');
          if (bytes.length) file = { name, type: String(a.type || 'application/octet-stream'), bytes };
        }
        if (!file || total + file.bytes.length > 24 * 1024 * 1024) { missed.push(name); continue; }
        total += file.bytes.length;
        files.push(file);
      }
      if (missed.length && body.strictAttachments !== false) {
        return NextResponse.json({ ok: false, error: `Could not attach: ${missed.join(', ')}`, missed }, { status: 422 });
      }
      const html = typeof body.html === 'string' ? String(body.html) : '';
      const sent = await withCreds(creds, () => gmailSend({
        html,
        files,
        to: String(body.to || ''),
        cc: body.cc,
        bcc: body.bcc,
        subject: String(body.subject || ''),
        text: String(body.text || ''),
        threadId: String(body.threadId || ''),
        messageId: String(body.messageId || ''),
        reply: action === 'reply',
      }));
      return NextResponse.json({ ok: sent.ok, drafted: sent.drafted, status: sent.status }, sent.ok || sent.drafted ? undefined : { status: 502 });
    }
    if (action === 'archive') {
      const sent = await withCreds(creds, () => gmailModify(id, [], ['INBOX']));
      return NextResponse.json({ ok: sent.ok, status: sent.status }, sent.ok ? undefined : { status: 502 });
    }
    if (action === 'done') {
      const sent = await withCreds(creds, () => gmailModify(id, [], ['INBOX', 'UNREAD']));
      return NextResponse.json({ ok: sent.ok, status: sent.status }, sent.ok ? undefined : { status: 502 });
    }
    if (action === 'read') {
      const sent = await withCreds(creds, () => gmailModify(id, [], ['UNREAD']));
      return NextResponse.json({ ok: sent.ok, status: sent.status }, sent.ok ? undefined : { status: 502 });
    }
    if (action === 'unread') {
      const sent = await withCreds(creds, () => gmailModify(id, ['UNREAD'], []));
      return NextResponse.json({ ok: sent.ok, status: sent.status }, sent.ok ? undefined : { status: 502 });
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
      return NextResponse.json({ ok: sent.ok, status: sent.status, until }, sent.ok ? undefined : { status: 502 });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (err) {
    fail('mail_act', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
