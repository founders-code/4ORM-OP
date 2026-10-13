import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { advisePlan } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const title = String(body?.title || '').trim().slice(0, 180);
    if (!title) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
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
    const plan = await advisePlan({
      title,
      area: String(body?.area || ''),
      steps: Array.isArray(body?.steps) ? body.steps.map((step: unknown) => String(step || '')) : [],
      record: JSON.stringify({ items, contacts, notes, linked: body?.record || null }).slice(0, 6000),
    });
    return NextResponse.json(plan);
  } catch {
    fail('plans_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
