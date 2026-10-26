import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { applyDedupe, listDupeGroups } from '@/lib/dedupe';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { cronSecret } from '@/lib/secrets';
import { openBoard, roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function chadOwner() {
  const sql = await getSql();
  if (!sql) return { sql: null as Awaited<ReturnType<typeof getSql>>, ownerId: '' };
  const ownerId = (await roomOwner(sql)) || '';
  return { sql, ownerId };
}

async function allowed(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (tokenOk(presented, cronSecret())) return true;
  const session = await openBoard();
  if (!session) return false;
  const user = await currentUser();
  const email = (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '').toLowerCase();
  return email.endsWith('@4ormfinance.com');
}

function preview(tables: Awaited<ReturnType<typeof listDupeGroups>>['tables']) {
  const first: Array<{ table: string; key: string; keep: string; keepAt: string | null; remove: number }> = [];
  for (const [table, groups] of Object.entries(tables)) {
    for (const g of groups) {
      if (first.length >= 15) return first;
      first.push({
        table,
        key: g.key.slice(0, 120),
        keep: g.keep.label.slice(0, 120),
        keepAt: g.keep.created_at,
        remove: g.remove.length,
      });
    }
  }
  return first;
}

export async function GET(req: Request) {
  try {
    if (!(await allowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sql, ownerId } = await chadOwner();
    if (!sql || !ownerId) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const listed = await listDupeGroups(sql, ownerId);
    const warItems = await sql`
      SELECT title AS t, status, count(*)::int AS n
      FROM items
      WHERE owner_id = ${ownerId}
        AND (
          (lower(title) LIKE '%kevin%' AND (lower(title) LIKE '%private-network%' OR lower(title) LIKE '%private network%'))
          OR lower(title) LIKE '%write who%'
          OR lower(title) LIKE '%the chunk%'
          OR lower(title) LIKE '%zahar%'
        )
      GROUP BY title, status ORDER BY n DESC
    `;
    let warActions: Record<string, unknown>[] = [];
    try {
      warActions = await sql`
        SELECT text AS t, count(*)::int AS n
        FROM meeting_actions
        WHERE owner_id = ${ownerId} AND deleted_at IS NULL AND status = 'open'
          AND (
            lower(text) LIKE 'open the next private-network conversation with kevin%'
            OR lower(text) LIKE 'write who, the chunk%'
            OR lower(text) LIKE 'then open zahar, bj, and daryl%'
          )
        GROUP BY text ORDER BY n DESC
      `;
    } catch {
      warActions = [];
    }
    return NextResponse.json({
      ok: true,
      dry: true,
      owner: 'chad',
      counts: listed.counts,
      groups: Object.fromEntries(Object.entries(listed.tables).map(([k, v]) => [k, v.length])),
      first15: preview(listed.tables),
      warItems,
      warActions,
      tables: listed.tables,
    });
  } catch (err) {
    fail('dedupe_dry', err);
    return NextResponse.json({ error: 'Could not list duplicates.' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await allowed(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sql, ownerId } = await chadOwner();
    if (!sql || !ownerId) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    if (body?.dry) {
      const listed = await listDupeGroups(sql, ownerId);
      return NextResponse.json({ ok: true, dry: true, owner: 'chad', counts: listed.counts, first15: preview(listed.tables), tables: listed.tables });
    }
    const result = await applyDedupe(sql, ownerId);
    return NextResponse.json({ ok: true, dry: false, owner: 'chad', ...result });
  } catch (err) {
    fail('dedupe_apply', err);
    return NextResponse.json({ error: 'Could not sweep duplicates.' }, { status: 400 });
  }
}
