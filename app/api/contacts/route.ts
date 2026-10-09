import { NextResponse } from 'next/server';
import { allowArea } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const body = await req.json().catch(() => null);
    const name = String(body?.name || '').trim().slice(0, 120);
    const area = allowArea(String(body?.area || 'other')) || 'other';
    if (!name) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const company = String(body?.company || '').slice(0, 120);
    const role = String(body?.role || '').slice(0, 120);
    const email = String(body?.email || '').slice(0, 180);
    const phone = String(body?.phone || '').slice(0, 40);
    const notes = String(body?.notes || '').slice(0, 500);
    const rows = await session.sql`
      INSERT INTO contacts (owner_id, name, company, role, email, phone, area, notes, source)
      VALUES (${session.userId}, ${name}, ${company}, ${role}, ${email}, ${phone}, ${area}, ${notes}, 'manual')
      RETURNING id, name, company, role, email, phone, area, notes
    `;
    const row = rows[0];
    return NextResponse.json({
      id: String(row.id),
      name: String(row.name),
      company: String(row.company || ''),
      role: String(row.role || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      area: String(row.area || 'other'),
      notes: String(row.notes || ''),
    });
  } catch {
    fail('contacts_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
