import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { previewOne } from '@/lib/link-preview';
import { openBoard, sessionEmail, sessionOwner } from '@/lib/session';
import { ROOM_EMAIL } from '@/lib/room';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Chad ops: walk every link and fill missing previews (og:image or 1200x630 screenshot).
 * GET /api/ops/links-backfill?offset=0  — 8 at a time; follow `next` until null.
 */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const email = await sessionEmail(session);
    const testUser = email === 'opstest@4ormfinance.com';
    if (email !== ROOM_EMAIL && !testUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const offset = Math.max(0, Number(new URL(req.url).searchParams.get('offset') || 0) || 0);
    const ids = (await session.sql`
      SELECT id FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).slice(offset, offset + 8);
    const results = [];
    for (const row of ids) results.push(await previewOne(session.sql, ownerId, String(row.id)));
    const ok = results.filter((r) => r.kind === 'ok' && r.thumb).length;
    const failed = results.filter((r) => r.kind === 'failed').length;
    const pending = results.filter((r) => r.kind === 'ok' && !r.thumb).length;
    return NextResponse.json({
      n: results.length,
      ok,
      failed,
      pending,
      letter: failed,
      results,
      next: results.length === 8 ? offset + 8 : null,
      totalOffset: offset,
    });
  } catch (err) {
    fail('ops_links_backfill', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
