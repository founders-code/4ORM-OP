import { NextResponse } from 'next/server';
import { allowArea, allowContactType, allowStage, allowTier } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

function present(body: Record<string, unknown> | null, key: string) {
  return !!body && Object.prototype.hasOwnProperty.call(body, key);
}

function text(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

function when(value: unknown) {
  if (value == null || value === '') return null;
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function shape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    company: String(row.company || ''),
    role: String(row.role || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    area: String(row.area || 'other'),
    notes: String(row.notes || ''),
    type: String(row.type || 'other'),
    tier: String(row.tier || 'B'),
    stage: String(row.stage || 'new'),
    nextAction: String(row.next_action || ''),
    nextDate: row.next_date ? new Date(String(row.next_date)).getTime() : null,
    lastTouch: row.last_touch ? new Date(String(row.last_touch)).getTime() : null,
  };
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const name = text(body?.name, 120);
    const area = allowArea(String(body?.area || 'other')) || 'other';
    if (!name) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const type = allowContactType(String(body?.type || 'other')) || 'other';
    const tier = allowTier(String(body?.tier || 'B')) || 'B';
    const stage = allowStage(String(body?.stage || 'new')) || 'new';
    if ((body?.type && !allowContactType(String(body.type))) || (body?.tier && !allowTier(String(body.tier))) || (body?.stage && !allowStage(String(body.stage)))) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const company = text(body?.company, 120);
    const role = text(body?.role, 120);
    const email = text(body?.email, 180);
    const phone = text(body?.phone, 40);
    const notes = text(body?.notes, 500);
    const nextAction = text(body?.nextAction, 180);
    const nextDate = when(body?.nextDate);
    if (nextDate === undefined) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const rows = await session.sql`
      INSERT INTO contacts (owner_id, name, company, role, email, phone, area, notes, source, type, tier, stage, next_action, next_date)
      VALUES (${session.userId}, ${name}, ${company}, ${role}, ${email}, ${phone}, ${area}, ${notes}, 'manual', ${type}, ${tier}, ${stage}, ${nextAction}, ${nextDate})
      RETURNING id, name, company, role, email, phone, area, notes, type, tier, stage, next_action, next_date, last_touch
    `;
    return NextResponse.json(shape(rows[0] as Record<string, unknown>));
  } catch {
    fail('contacts_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = String(body?.id || '');
    if (!ID.test(id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const name = text(body?.name, 120);
    const company = text(body?.company, 120);
    const role = text(body?.role, 120);
    const email = text(body?.email, 180);
    const phone = text(body?.phone, 40);
    const notes = text(body?.notes, 500);
    const nextAction = text(body?.nextAction, 180);
    const area = present(body, 'area') ? allowArea(String(body?.area || '')) : null;
    const type = present(body, 'type') ? allowContactType(String(body?.type || '')) : null;
    const tier = present(body, 'tier') ? allowTier(String(body?.tier || '')) : null;
    const stage = present(body, 'stage') ? allowStage(String(body?.stage || '')) : null;
    if ((present(body, 'name') && !name) || (present(body, 'area') && !area) || (present(body, 'type') && !type) || (present(body, 'tier') && !tier) || (present(body, 'stage') && !stage)) {
      return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    }
    const setNext = present(body, 'nextDate');
    const nextDate = setNext ? when(body?.nextDate) : null;
    if (setNext && nextDate === undefined) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const setTouch = present(body, 'lastTouch');
    const lastTouch = setTouch ? when(body?.lastTouch) : null;
    if (setTouch && lastTouch === undefined) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const flags = ['name', 'company', 'role', 'email', 'phone', 'area', 'notes', 'type', 'tier', 'stage', 'nextAction', 'nextDate', 'lastTouch'];
    if (!flags.some((key) => present(body, key))) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const rows = await session.sql`
      UPDATE contacts SET
        name = CASE WHEN ${present(body, 'name')} THEN ${name} ELSE name END,
        company = CASE WHEN ${present(body, 'company')} THEN ${company} ELSE company END,
        role = CASE WHEN ${present(body, 'role')} THEN ${role} ELSE role END,
        email = CASE WHEN ${present(body, 'email')} THEN ${email} ELSE email END,
        phone = CASE WHEN ${present(body, 'phone')} THEN ${phone} ELSE phone END,
        area = CASE WHEN ${present(body, 'area')} THEN ${area} ELSE area END,
        notes = CASE WHEN ${present(body, 'notes')} THEN ${notes} ELSE notes END,
        type = CASE WHEN ${present(body, 'type')} THEN ${type} ELSE type END,
        tier = CASE WHEN ${present(body, 'tier')} THEN ${tier} ELSE tier END,
        stage = CASE WHEN ${present(body, 'stage')} THEN ${stage} ELSE stage END,
        next_action = CASE WHEN ${present(body, 'nextAction')} THEN ${nextAction} ELSE next_action END,
        next_date = CASE WHEN ${setNext} THEN ${nextDate}::timestamptz ELSE next_date END,
        last_touch = CASE WHEN ${setTouch} THEN ${lastTouch}::timestamptz ELSE last_touch END
      WHERE id = ${id} AND owner_id = ${session.userId}
      RETURNING id, name, company, role, email, phone, area, notes, type, tier, stage, next_action, next_date, last_touch
    `;
    if (!rows.length) return NextResponse.json({ error: 'Unavailable' }, { status: 404 });
    return NextResponse.json(shape(rows[0] as Record<string, unknown>));
  } catch {
    fail('contacts_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
