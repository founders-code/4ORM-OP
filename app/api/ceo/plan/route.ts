import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { fallbackPlan } from '@/lib/war-core.mjs';
import { advisePlan } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const title = String(body?.title || '').trim().slice(0, 180);
  const area = String(body?.area || '');
  const steps = Array.isArray(body?.steps) ? body.steps.map((step: unknown) => String(step || '')) : [];
  if (!title) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json(fallbackPlan({ title, area, steps }));
    let record = '';
    try {
      const items = await session.sql`
        SELECT title, area, status, owner
        FROM items WHERE owner_id = ${session.userId}
        ORDER BY updated_at DESC LIMIT 30
      `;
      const contacts = await session.sql`
        SELECT name, company, stage, next_action
        FROM contacts WHERE owner_id = ${session.userId}
        ORDER BY name LIMIT 20
      `;
      const notes = await session.sql`
        SELECT title, others, improve
        FROM zoom_notes WHERE owner_id = ${session.userId}
        ORDER BY note_date DESC LIMIT 8
      `;
      record = JSON.stringify({ items, contacts, notes, linked: body?.record || null }).slice(0, 6000);
    } catch (err) {
      fail('plans_context', err);
    }
    return NextResponse.json(await advisePlan({ title, area, steps, record }));
  } catch (err) {
    fail('plans_failed', err);
    return NextResponse.json(fallbackPlan({ title, area, steps }));
  }
}
