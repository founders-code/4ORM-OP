import { NextResponse } from 'next/server';
import { addItem, draftText, patchDraft, readDraft, readMonth, readSection } from '@/lib/investor-update';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function gate() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { error: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId };
}

/** The investor update draft for ?month=YYYY-MM (default: this month, Vancouver). Never sends anything. */
export async function GET(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const month = readMonth(new URL(req.url).searchParams.get('month'));
    const draft = await readDraft(g.sql, g.ownerId, month);
    return NextResponse.json({ ...draft, text: draftText(draft) });
  } catch (err) {
    fail('investor_update_get', err);
    return NextResponse.json({ error: 'The investor update could not be read.' }, { status: 500 });
  }
}

/** Add an item: { section?, title, body?, source?, sourceRef?, url?, month? }. Same sourceRef twice = one item. */
export async function POST(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const title = String(body?.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Nothing to add.' }, { status: 400 });
    const month = readMonth(body?.month);
    const url = String(body?.url || '');
    const out = await addItem(g.sql, g.ownerId, month, {
      section: readSection(body?.section),
      title,
      body: String(body?.body || ''),
      source: String(body?.source || 'manual'),
      sourceRef: String(body?.sourceRef || ''),
      url: /^https?:\/\//i.test(url) ? url : '',
    });
    return NextResponse.json({ ok: true, existed: out.existed, item: out.item, month });
  } catch (err) {
    fail('investor_update_add', err);
    return NextResponse.json({ error: 'Could not add that to the investor update.' }, { status: 500 });
  }
}

/** Edit the draft head: { month?, title?, intro?, asks? }. */
export async function PATCH(req: Request) {
  try {
    const g = await gate();
    if ('error' in g) return g.error;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const month = readMonth(body?.month);
    await patchDraft(g.sql, g.ownerId, month, {
      title: body?.title != null ? String(body.title) : undefined,
      intro: body?.intro != null ? String(body.intro) : undefined,
      asks: body?.asks != null ? String(body.asks) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('investor_update_patch', err);
    return NextResponse.json({ error: 'The draft could not be saved.' }, { status: 500 });
  }
}
