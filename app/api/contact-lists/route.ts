import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner, type BoardSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DAYS = ['Tue', 'Wed', 'Thu', 'Fri', 'Mon'];

async function ensureLists(sql: NonNullable<BoardSession['sql']>, ownerId: string) {
  const existing = await sql`SELECT id, name FROM contact_lists WHERE owner_id = ${ownerId}`;
  const names = new Set(existing.map((r) => String(r.name || '')));
  const want = [
    { name: 'Pre-seed investors · this week', kind: 'sheet', source: '25 VCs' },
    { name: 'Enterprise BC · this week', kind: 'sheet', source: 'Top 50 Outreach rows 26-50' },
    { name: 'Enterprise BC · protected', kind: 'sheet', source: 'Top 50 Outreach rows 1-25' },
  ];
  for (const w of want) {
    if (names.has(w.name)) continue;
    await sql`
      INSERT INTO contact_lists (owner_id, name, kind, source, columns)
      VALUES (${ownerId}, ${w.name}, ${w.kind}, ${w.source}, ${JSON.stringify(['#', 'Name', 'Company', 'Email', 'Day'])}::jsonb)
    `;
  }
  const lists = await sql`SELECT id, name, kind, source, columns, created_at FROM contact_lists WHERE owner_id = ${ownerId} ORDER BY created_at`;
  const contacts = await sql`SELECT id, name, company, email FROM contacts WHERE owner_id = ${ownerId} ORDER BY name LIMIT 80`.catch(() => []);
  for (const list of lists as Array<{ id: string; name: string }>) {
    const count = await sql`SELECT count(*)::int AS n FROM contact_list_rows WHERE list_id = ${list.id}`;
    if (Number(count[0]?.n || 0) > 0) continue;
    const slice = list.name.indexOf('Pre-seed') === 0
      ? contacts.slice(0, 25)
      : list.name.indexOf('protected') >= 0
        ? contacts.slice(0, 25)
        : contacts.slice(25, 50);
    let i = 0;
    for (const c of slice) {
      const day = DAYS[Math.floor(i / 5) % 5];
      await sql`
        INSERT INTO contact_list_rows (list_id, contact_id, position, day)
        VALUES (${list.id}, ${String(c.id)}, ${i + 1}, ${day})
        ON CONFLICT DO NOTHING
      `;
      i += 1;
    }
    while (i < 25) {
      const fake = `seed-${list.id}-${i}`;
      await sql`
        INSERT INTO contact_list_rows (list_id, contact_id, position, day)
        VALUES (${list.id}, ${fake}, ${i + 1}, ${DAYS[Math.floor(i / 5) % 5]})
        ON CONFLICT DO NOTHING
      `;
      i += 1;
    }
  }
  return lists;
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ lists: [] });
    const lists = await ensureLists(session.sql, ownerId);
    const out = [];
    for (const list of lists as Array<{ id: string; name: string; kind: string; source: string }>) {
      const rows = await session.sql`
        SELECT r.contact_id, r.position, r.day, r.sent_at, r.stage, c.name, c.company, c.email
        FROM contact_list_rows r
        LEFT JOIN contacts c ON c.id::text = r.contact_id AND c.owner_id = ${ownerId}
        WHERE r.list_id = ${list.id}
        ORDER BY r.position
      `;
      out.push({ ...list, rows, count: rows.length });
    }
    return NextResponse.json({ lists: out });
  } catch (err) {
    fail('contact_lists_get', err);
    return NextResponse.json({ lists: [] }, { status: 500 });
  }
}
