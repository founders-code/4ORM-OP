import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { withCreds } from '@/lib/creds';
import { ensureGhlContact, ghlConfigured, sendViaGhl } from '@/lib/ghl';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const rows = await session.sql`
      UPDATE contacts SET deleted_at = now()
      WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
      RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json({ id: String((rows[0] as { id: string }).id) });
  } catch {
    fail('contacts_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

function escHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * POST { action: 'email', subject, body } → sends ONE email to this contact through GoHighLevel
 * (conversations/messages, from chad@4ormfinance.com) and stamps last_touch. 1:1 only; never a bulk send.
 * 400 bad input or no email on file · 404 contact gone · 503 GoHighLevel not connected · 502 GoHighLevel refused.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    if (!ID.test(params.id)) return NextResponse.json({ error: 'Unknown contact.' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (String(body?.action || '') !== 'email') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    const subject = String(body?.subject || '').trim().slice(0, 200);
    const text = String(body?.body || '').trim().slice(0, 8000);
    if (!subject || !text) return NextResponse.json({ error: 'Add a subject and a message.' }, { status: 400 });
    const rows = await session.sql`
      SELECT id, name, company, email FROM contacts
      WHERE id = ${params.id} AND owner_id = ${session.userId} AND deleted_at IS NULL
    `;
    const row = rows[0] as { name?: string; company?: string; email?: string } | undefined;
    if (!row) return NextResponse.json({ error: 'That contact is gone.' }, { status: 404 });
    const email = String(row.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'No email on file for this person.' }, { status: 400 });
    const creds = await loadCredsFor(session.userId);
    const result = await withCreds(creds, async () => {
      if (!ghlConfigured()) return 'off' as const;
      const contactId = await ensureGhlContact({ name: String(row.name || ''), company: String(row.company || ''), email });
      if (!contactId) return 'refused' as const;
      const html = escHtml(text).replace(/\r?\n/g, '<br>');
      return (await sendViaGhl({ contactId, email, subject, html })) ? ('sent' as const) : ('refused' as const);
    });
    if (result === 'off') return NextResponse.json({ error: 'GoHighLevel is not connected.' }, { status: 503 });
    if (result === 'refused') return NextResponse.json({ error: 'GoHighLevel did not send it.' }, { status: 502 });
    const touched = await session.sql`
      UPDATE contacts SET last_touch = now() WHERE id = ${params.id} AND owner_id = ${session.userId}
      RETURNING last_touch
    `;
    const at = touched[0] ? new Date(String((touched[0] as { last_touch: string }).last_touch)).getTime() : Date.now();
    return NextResponse.json({ ok: true, sent: true, lastTouch: at });
  } catch (err) {
    fail('contacts_email', err);
    return NextResponse.json({ error: 'Could not send that email.' }, { status: 500 });
  }
}
