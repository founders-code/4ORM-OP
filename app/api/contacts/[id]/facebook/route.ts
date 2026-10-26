import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { createContact } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;
const STATUS = ['not_sent', 'sent', 'replied'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !ID.test(params.id)) return NextResponse.json({ error: 'Could not update that contact.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const action = String(body?.action || '');
    if (action === 'status') {
      const status = STATUS.includes(String(body?.status || '')) ? String(body.status) : '';
      if (!status) return NextResponse.json({ error: 'Could not update that contact.' }, { status: 400 });
      await session.sql`UPDATE contacts SET fb_status = ${status} WHERE id = ${params.id} AND owner_id = ${session.userId}`;
      return NextResponse.json({ ok: true, status });
    }
    if (action === 'promote') {
      const rows = await session.sql`SELECT name, company, fb_ask FROM contacts WHERE id = ${params.id} AND owner_id = ${session.userId}`;
      const row = rows[0] as { name?: string; company?: string; fb_ask?: string } | undefined;
      if (!row) return NextResponse.json({ error: 'Could not promote that contact.' }, { status: 400 });
      const creds = await loadCredsFor(session.userId);
      const ghlId = await withCreds(creds, () => createContact({ name: String(row.name || ''), company: String(row.company || row.fb_ask || '') }));
      await session.sql`UPDATE contacts SET category = 'vc', fb_status = 'sent' WHERE id = ${params.id} AND owner_id = ${session.userId}`;
      return NextResponse.json({ ok: true, ghl: !!ghlId, error: ghlId ? '' : 'Marked for the pipeline. GoHighLevel did not take the contact.' });
    }
    return NextResponse.json({ error: 'Could not update that contact.' }, { status: 400 });
  } catch (err) {
    fail('facebook_contact', err);
    return NextResponse.json({ error: 'Could not update that contact.' }, { status: 500 });
  }
}
