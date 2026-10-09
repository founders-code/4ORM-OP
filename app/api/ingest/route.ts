import { NextResponse } from 'next/server';
import { allowArea, allowPriority, allowStatus, tokenOk, windowKey } from '@/lib/guard.mjs';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

function denied() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  if (!tokenOk(req.headers.get('x-ingest-token'), process.env.INGEST_TOKEN)) return denied();
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const ownerId = await roomOwner(sql);
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items.slice(0, 40) : null;
    if (!ownerId || !items) return NextResponse.json({ added: 0, skipped: 0 });
    const claimed = await sql`
      INSERT INTO ingest_guard (owner_id, window_key)
      VALUES (${ownerId}, ${windowKey()})
      ON CONFLICT DO NOTHING
      RETURNING owner_id
    `;
    if (!claimed.length) return denied();
    let added = 0;
    let skipped = 0;
    for (const raw of items) {
      const title = String(raw?.title || '').trim().slice(0, 180);
      const area = allowArea(String(raw?.area || ''));
      const status = allowStatus(String(raw?.status || 'new'));
      const priority = allowPriority(String(raw?.priority || 'normal'));
      const source = String(raw?.source || 'manual').replace(/[^\w]/g, '').slice(0, 32) || 'manual';
      const sourceId = raw?.source_id ? String(raw.source_id).slice(0, 180) : '';
      const owner = raw?.owner ? String(raw.owner).slice(0, 80) : '';
      const due = raw?.due ? new Date(String(raw.due)) : null;
      if (!title || !area || !status || !priority || (raw?.due && Number.isNaN(due?.getTime()))) {
        skipped += 1;
        continue;
      }
      const dueIso = due ? due.toISOString() : null;
      if (!sourceId) {
        await sql`
          INSERT INTO items (owner_id, title, area, status, priority, due, owner, source)
          VALUES (${ownerId}, ${title}, ${area}, ${status}, ${priority}, ${dueIso}, ${owner}, ${source})
        `;
        added += 1;
        continue;
      }
      const rows = await sql`
        INSERT INTO items (owner_id, title, area, status, priority, due, owner, source, source_id)
        VALUES (${ownerId}, ${title}, ${area}, ${status}, ${priority}, ${dueIso}, ${owner}, ${source}, ${sourceId})
        ON CONFLICT (owner_id, source, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET title = EXCLUDED.title, due = EXCLUDED.due, priority = EXCLUDED.priority, updated_at = now()
        RETURNING (created_at = updated_at) AS inserted
      `;
      if (rows[0]?.inserted) added += 1;
      else skipped += 1;
    }
    return NextResponse.json({ added, skipped });
  } catch {
    fail('ingest_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
