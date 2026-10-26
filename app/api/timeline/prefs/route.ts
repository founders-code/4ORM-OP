import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { ensureTimeline } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    await ensureTimeline(session.sql);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    await session.sql`
      INSERT INTO timeline_prefs (owner_id, pipeline_order, hidden, open, zoom, show_links, one_move_id, updated_at)
      VALUES (
        ${session.userId},
        ${JSON.stringify(body.pipeline_order || [])}::jsonb,
        ${JSON.stringify(body.hidden || [])}::jsonb,
        ${JSON.stringify(body.open || [])}::jsonb,
        ${String(body.zoom || '6')},
        ${body.show_links !== false},
        ${body.one_move_id ? String(body.one_move_id) : null},
        now()
      )
      ON CONFLICT (owner_id) DO UPDATE SET
        pipeline_order = CASE WHEN ${body.pipeline_order != null} THEN ${JSON.stringify(body.pipeline_order || [])}::jsonb ELSE timeline_prefs.pipeline_order END,
        hidden = CASE WHEN ${body.hidden != null} THEN ${JSON.stringify(body.hidden || [])}::jsonb ELSE timeline_prefs.hidden END,
        open = CASE WHEN ${body.open != null} THEN ${JSON.stringify(body.open || [])}::jsonb ELSE timeline_prefs.open END,
        zoom = CASE WHEN ${body.zoom != null} THEN ${String(body.zoom || '6')} ELSE timeline_prefs.zoom END,
        show_links = CASE WHEN ${body.show_links != null} THEN ${body.show_links !== false} ELSE timeline_prefs.show_links END,
        one_move_id = CASE WHEN ${body.one_move_id !== undefined} THEN ${body.one_move_id ? String(body.one_move_id) : null} ELSE timeline_prefs.one_move_id END,
        updated_at = now()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('timeline_prefs', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}
