import { NextResponse } from 'next/server';
import { createContact } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { withCreds } from '@/lib/creds';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not promote that name.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    if (String(body?.action || '') !== 'promote') return NextResponse.json({ error: 'Could not promote that name.' }, { status: 400 });
    const rows = await session.sql`SELECT name, note FROM vc_inbox WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    const row = rows[0] as { name?: string; note?: string } | undefined;
    if (!row) return NextResponse.json({ error: 'Could not promote that name.' }, { status: 400 });
    const creds = await loadCredsFor(session.userId);
    const ghlId = await withCreds(creds, () => createContact({ name: String(row.name || ''), company: String(row.note || '') }));
    await session.sql`
      INSERT INTO contacts (owner_id, name, notes, source, type, tier, stage, category)
      VALUES (${session.userId}, ${String(row.name || '')}, ${String(row.note || '')}, 'vc_inbox', 'other', 'B', 'new', 'vc')
    `;
    await session.sql`UPDATE vc_inbox SET status = 'promoted' WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    return NextResponse.json({ ok: true, ghl: !!ghlId, error: ghlId ? '' : 'Saved on the pipeline. GoHighLevel did not take the contact.' });
  } catch (err) {
    fail('vc_inbox', err);
    return NextResponse.json({ error: 'Could not promote that name.' }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not delete that name.' }, { status: 400 });
    await session.sql`DELETE FROM vc_inbox WHERE id = ${params.id} AND owner_id = ${session.userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('vc_inbox', err);
    return NextResponse.json({ error: 'Could not delete that name.' }, { status: 400 });
  }
}
