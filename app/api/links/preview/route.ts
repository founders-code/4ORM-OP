import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { previewOne } from '@/lib/link-preview';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    const backfill = url.searchParams.get('backfill') === '1' || url.searchParams.get('backfill') === 'all';
    const all = url.searchParams.get('backfill') === 'all';
    if (id) {
      const one = await previewOne(session.sql, ownerId, id);
      return NextResponse.json(one);
    }
    if (backfill) {
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
      const pending = all
        ? (await session.sql`
            SELECT id FROM links WHERE owner_id = ${ownerId} AND deleted_at IS NULL
            ORDER BY created_at DESC
          `).slice(offset, offset + 8)
        : await session.sql`
            SELECT id FROM links
            WHERE owner_id = ${ownerId} AND deleted_at IS NULL
              AND (
                thumb_url IS NULL OR thumb_url = ''
                OR coalesce(thumb_status, '') IN ('', 'pending', 'failed')
              )
            ORDER BY created_at DESC LIMIT 3
          `;
      const results = [];
      for (const row of pending) results.push(await previewOne(session.sql, ownerId, String(row.id)));
      const ok = results.filter((r) => r.kind === 'ok' && r.thumb).length;
      const pendingN = results.filter((r) => r.kind === 'ok' && !r.thumb).length;
      const failed = results.filter((r) => r.kind === 'failed').length;
      return NextResponse.json({
        n: results.length,
        results,
        ok,
        letter: failed,
        pending: pendingN,
        failed,
        next: all && results.length === 8 ? offset + 8 : null,
      });
    }
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  } catch (err) {
    fail('links_preview', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
