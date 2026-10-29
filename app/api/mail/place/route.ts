import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { createOpportunityAt, ensureGhlContact, ghlPlaceFor, moveOpportunityStage } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard, sessionEmail, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* Email page, right rail: where the sender sits in GoHighLevel, and a stage move for them.
   GET ?email= reads only. POST moves an existing opportunity, or adds the contact and opens one at the stage Chad picked. */

const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[a-z]{2,}$/i;

async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session, ownerId };
}

async function growthIdFor(sql: NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql'], ownerId: string, email: string) {
  if (!sql) return '';
  try {
    const rows = await sql`SELECT id FROM growth_records WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      AND position(${email.toLowerCase()} in lower(email)) > 0 ORDER BY rank LIMIT 1`;
    return rows[0] ? String((rows[0] as { id: string }).id) : '';
  } catch {
    return '';
  }
}

export async function GET(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const email = String(new URL(req.url).searchParams.get('email') || '').trim().slice(0, 180);
    if (!EMAIL.test(email)) return NextResponse.json({ error: 'No email' }, { status: 400 });
    const creds = await loadCredsFor(g.session.userId);
    const [place, growthId] = await Promise.all([
      withCreds(creds, () => ghlPlaceFor(email)),
      growthIdFor(g.session.sql, g.ownerId, email),
    ]);
    return NextResponse.json({ ...place, growthId });
  } catch (err) {
    fail('mail_place_get', err);
    return NextResponse.json({ connected: false, contactId: '', opps: [], pipelines: [], growthId: '' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(b.email || '').trim().slice(0, 180);
    const name = String(b.name || '').trim().slice(0, 120) || email;
    const pipelineId = String(b.pipelineId || '').slice(0, 64);
    const stageId = String(b.stageId || '').slice(0, 64);
    const opportunityId = String(b.opportunityId || '').slice(0, 64);
    if (!pipelineId || !stageId) return NextResponse.json({ error: 'Pick a stage' }, { status: 400 });
    /* The opstest account may only write to GoHighLevel for TEST senders. */
    const who = await sessionEmail(g.session).catch(() => '');
    if (/opstest@4ormfinance\.com/i.test(String(who || '')) && !/TEST|opstest/i.test(name + ' ' + email)) {
      return NextResponse.json({ error: 'Test account: GoHighLevel writes only for TEST senders' }, { status: 403 });
    }
    const creds = await loadCredsFor(g.session.userId);
    if (opportunityId) {
      const moved = await withCreds(creds, () => moveOpportunityStage({ opportunityId, pipelineId, stageId }));
      if (!moved.ok) return NextResponse.json({ error: moved.note }, { status: moved.status });
      return NextResponse.json({ ok: true, opportunityId });
    }
    if (!EMAIL.test(email)) return NextResponse.json({ error: 'This sender has no email address' }, { status: 400 });
    const contactId = await withCreds(creds, () => ensureGhlContact({ name, email }));
    if (!contactId) return NextResponse.json({ error: 'GoHighLevel did not add this contact' }, { status: 502 });
    const oppId = await withCreds(creds, () => createOpportunityAt({ contactId, name, pipelineId, stageId }));
    if (!oppId) return NextResponse.json({ error: 'GoHighLevel did not open the opportunity' }, { status: 502 });
    return NextResponse.json({ ok: true, opportunityId: oppId, added: true });
  } catch (err) {
    fail('mail_place_post', err);
    return NextResponse.json({ error: 'GoHighLevel did not take that stage' }, { status: 500 });
  }
}
