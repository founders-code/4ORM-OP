import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { cleanEmails, cleanTags, pushBoxTags } from '@/lib/ghl-tags';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * B56: write box tags back to Contacts and GoHighLevel.
 * Body: { emails: string[] (the box addresses, max 10), add?: string[], remove?: string[] }.
 * GoHighLevel contacts are found by email and never created here.
 */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const emails = cleanEmails(body?.emails);
    const add = cleanTags(body?.add);
    const remove = cleanTags(body?.remove).filter((t) => !add.includes(t));
    if (!emails.length) return NextResponse.json({ error: 'This box has no email address yet.' }, { status: 400 });
    if (!add.length && !remove.length) return NextResponse.json({ error: 'No tag to change.' }, { status: 400 });
    const creds = await loadCredsFor(session.userId);
    const sql = session.sql;
    const results = await withCreds(creds, () => pushBoxTags(sql, ownerId, emails, add, remove));
    return NextResponse.json({
      ok: true,
      results,
      ghlTagged: results.filter((r) => r.ghl === 'tagged').length,
      contactsTagged: results.reduce((n, r) => n + r.contacts, 0),
      ghl: results.some((r) => r.ghl === 'not_connected') ? 'not_connected' : 'connected',
    });
  } catch (err) {
    fail('ghl_tags', err);
    return NextResponse.json({ error: 'Tags could not be written back.' }, { status: 500 });
  }
}
