import { NextResponse } from 'next/server';
import { readMailCache } from '@/lib/changes';
import { withCreds } from '@/lib/creds';
import { createReplyDraft } from '@/lib/google';
import { cacheInbox } from '@/lib/live';
import { fail } from '@/lib/log';
import { openBoard, roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ messages: [], linkedin: [], hidden: [] });
    const ownerId = (await roomOwner(session.sql)) || session.userId;
    let cached = await readMailCache(session.sql, ownerId);
    if (!cached) {
      const creds = await loadCredsFor(session.userId);
      await withCreds(creds, () => cacheInbox(session.sql!, ownerId, true)).catch((err) => fail('mail_inbox', err));
      cached = await readMailCache(session.sql, ownerId);
    }
    const messages = (cached?.messages || []) as Array<Record<string, unknown>>;
    let hidden: string[] = [];
    try {
      await session.sql`CREATE TABLE IF NOT EXISTS inbox_hidden (
        owner_id text NOT NULL,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, email)
      )`;
      const rows = await session.sql`SELECT email FROM inbox_hidden WHERE owner_id = ${session.userId}`;
      hidden = (rows as Array<{ email?: string }>).map((row) => String(row.email || '').toLowerCase()).filter(Boolean);
    } catch (err) {
      fail('mail_hidden', err);
    }
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
    return NextResponse.json({ messages, linkedin: cached?.linkedin || [], hidden });
  } catch (err) {
    fail('mail_inbox', err);
    return NextResponse.json({ messages: [], linkedin: [], hidden: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ saved: false });
    const hide = String(body.hide || body.hideEmail || '').trim().toLowerCase().slice(0, 180);
    const show = String(body.show || body.showEmail || '').trim().toLowerCase().slice(0, 180);
    if (hide || show) {
      try {
        await session.sql`CREATE TABLE IF NOT EXISTS inbox_hidden (
          owner_id text NOT NULL,
          email text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (owner_id, email)
        )`;
        if (hide && hide.includes('@')) {
          await session.sql`INSERT INTO inbox_hidden (owner_id, email) VALUES (${session.userId}, ${hide}) ON CONFLICT (owner_id, email) DO NOTHING`;
        }
        if (show && show.includes('@')) {
          await session.sql`DELETE FROM inbox_hidden WHERE owner_id = ${session.userId} AND email = ${show}`;
        }
      } catch (err) {
        fail('mail_hidden', err);
        return NextResponse.json({ saved: false });
      }
      return NextResponse.json({ saved: true });
    }
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
