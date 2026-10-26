import { NextResponse } from 'next/server';
import { applyDedupe, listDupeGroups, listRestorable } from '@/lib/dedupe';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { cronSecret } from '@/lib/secrets';
import { isRoomEmail, openBoard, roomOwner, sessionEmail } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function chadOwner() {
  const sql = await getSql();
  if (!sql) return { sql: null as Awaited<ReturnType<typeof getSql>>, ownerId: '' };
  const ownerId = (await roomOwner(sql)) || '';
  return { sql, ownerId };
}

/** Operator bearer (CRON_SECRET) or Chad himself. Colleagues and test users are refused. */
async function allowed(req: Request): Promise<'ok' | 'unauthorized' | 'forbidden'> {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (presented) return tokenOk(presented, cronSecret()) ? 'ok' : 'unauthorized';
  const session = await openBoard();
  if (!session) return 'unauthorized';
  return isRoomEmail(await sessionEmail(session)) ? 'ok' : 'forbidden';
}

function denied(result: 'unauthorized' | 'forbidden') {
  return result === 'forbidden'
    ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const access = await allowed(req);
    if (access !== 'ok') return denied(access);
    const { sql, ownerId } = await chadOwner();
    if (!sql || !ownerId) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (new URL(req.url).searchParams.get('restorable') === '1') {
      const restorable = await listRestorable(sql, ownerId);
      return NextResponse.json({ ok: true, readOnly: true, owner: 'chad', ...restorable });
    }
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
    return NextResponse.json({ error: 'Could not list duplicates.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await allowed(req);
    if (access !== 'ok') return denied(access);
    const { sql, ownerId } = await chadOwner();
    if (!sql || !ownerId) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = await req.json().catch(() => null);
    if (body?.dry) {
      const listed = await listDupeGroups(sql, ownerId);
      return NextResponse.json({ ok: true, dry: true, owner: 'chad', counts: listed.counts, first15: preview(listed.tables), tables: listed.tables });
    }
    if (body?.restoreWar) {
      const titles = [
        'Open the next private-network conversation with Kevin.',
        'Write who, the chunk, the step, the next action, and the next date.',
        'Then open Zahar, BJ, and Daryl, one $25,000 chunk each.',
      ];
      const restored: Array<{ title: string; id: string; via: string }> = [];
      for (const title of titles) {
        const key = title.toLowerCase();
        const logged = await sql`
          SELECT kept_id FROM dedupe_log
          WHERE owner_id = ${ownerId} AND table_name = 'items' AND lower(dup_key) = ${key}
          ORDER BY created_at DESC
          LIMIT 1
        `;
        let id = logged[0] ? String(logged[0].kept_id) : '';
        let via = 'log';
        if (!id) {
          const oldest = await sql`
            SELECT id FROM items
            WHERE owner_id = ${ownerId} AND lower(trim(title)) = ${key}
            ORDER BY created_at ASC, id ASC LIMIT 1
          `;
          id = oldest[0] ? String(oldest[0].id) : '';
          via = 'oldest';
        }
        if (!id) continue;
        await sql`UPDATE items SET status = 'new', due = now() WHERE id::text = ${id} AND owner_id = ${ownerId}`;
        restored.push({ title, id, via });
      }
      return NextResponse.json({ ok: true, restoreWar: true, owner: 'chad', restored });
    }
    const result = await applyDedupe(sql, ownerId);
    return NextResponse.json({ ok: true, dry: false, owner: 'chad', ...result });
  } catch (err) {
    fail('dedupe_apply', err);
    return NextResponse.json({ error: 'Could not sweep duplicates.' }, { status: 500 });
  }
}
