import { NextResponse } from 'next/server';
import { applyChadAccountFix, archiveClaudeTestItems, archiveJunkBox, chadDoneCounts, importSnapshotBoxes, listDeletedBoxes, listRestoreLogs, restoreDeletedBoxes, searchBoxesElsewhere } from '@/lib/chad-account-fix';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';
import { isRoomEmail, openBoard, roomOwner, sessionEmail } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function chadOnly() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isRoomEmail(await sessionEmail(session))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const sql = session.sql || (await getSql());
  if (!sql) return { error: NextResponse.json({ error: 'Unavailable' }, { status: 400 }) };
  const room = await roomOwner(sql).catch(() => '');
  const owners = [...new Set([session.userId, room].filter(Boolean).map(String))];
  return { sql, owners, userId: session.userId };
}

export async function GET(req: Request) {
  try {
    const gate = await chadOnly();
    if ('error' in gate && gate.error) return gate.error;
    const { sql, owners } = gate as { sql: NonNullable<Awaited<ReturnType<typeof getSql>>>; owners: string[] };
    const onlyNotes = new URL(req.url).searchParams.get('notes') === '1';
    const CLUSTER = 'd1fa61d7-8f49-48d1-b62d-3ffd8bb976fa';
    const notes = [];
    for (const ownerId of owners) {
      try {
        const live = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL`;
        const gone = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL`;
        const titles = await sql`
          SELECT title, CASE WHEN deleted_at IS NULL THEN false ELSE true END AS del
          FROM notes WHERE owner_id = ${ownerId}
          ORDER BY updated_at DESC NULLS LAST LIMIT 80
        `;
        let cluster: Record<string, unknown> | null = null;
        try {
          const cl = await sql`
            SELECT id::text, name, to_char(created_at AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD HH24:MI:SS') AS created_van
            FROM note_clusters WHERE id = ${CLUSTER}::uuid AND owner_id = ${ownerId}
          `;
          cluster = (cl[0] as Record<string, unknown>) || null;
        } catch {
          cluster = null;
        }
        notes.push({
          ownerId,
          live: Number(live[0]?.n || 0),
          deleted: Number(gone[0]?.n || 0),
          titles: (titles as { title?: string; del?: boolean }[]).map((t) => ({ title: t.title || '', del: !!t.del })),
          cluster,
        });
      } catch (err) {
        fail('chad_account_notes_probe', err);
        notes.push({ ownerId, live: -1, deleted: -1, titles: [], cluster: null, error: String((err as Error)?.message || err) });
      }
    }
    const pitr = {
      neonProject: process.env.NEON_PROJECT_ID ? 'set' : 'missing',
      neonApiKey: process.env.NEON_API_KEY || process.env.NEON_API_TOKEN ? 'set' : 'missing',
      note: 'A read-only PITR branch needs NEON_API_KEY. It is not in Vercel env; DATABASE_URL is Sensitive and cannot be pulled locally.',
    };
    if (onlyNotes) return NextResponse.json({ ok: true, readOnly: true, owners, notes, pitr });
    const boxes = [];
    for (const ownerId of owners) {
      try {
        const deleted = await listDeletedBoxes(sql, ownerId);
        const elsewhere = await searchBoxesElsewhere(sql, ownerId);
        const allBoxes = await sql`
          SELECT key, name, org, deleted_at, created_at
          FROM email_boxes WHERE owner_id = ${ownerId}
          ORDER BY deleted_at NULLS FIRST, name
        `;
        const live = await sql`
          SELECT key, name, deleted_at,
            (SELECT count(*)::int FROM email_box_addresses a WHERE a.owner_id = email_boxes.owner_id AND a.box_key = email_boxes.key AND a.deleted_at IS NULL) AS addr_n,
            (SELECT count(*)::int FROM email_box_tags t WHERE t.owner_id = email_boxes.owner_id AND t.box_key = email_boxes.key AND t.deleted_at IS NULL) AS tag_n
          FROM email_boxes
          WHERE owner_id = ${ownerId} AND deleted_at IS NULL
          ORDER BY name
        `;
        const counts = await chadDoneCounts(sql, ownerId);
        const restoreLogs = await listRestoreLogs(sql, ownerId);
        boxes.push({ ownerId, deleted, live, allBoxes, elsewhere, restoreLogs, done: counts });
      } catch (err) {
        fail('chad_account_boxes_probe', err);
        boxes.push({ ownerId, error: String((err as Error)?.message || err) });
      }
    }
    return NextResponse.json({ ok: true, readOnly: true, owners, boxes, notes, pitr });
  } catch (err) {
    fail('chad_account_get', err);
    return NextResponse.json({ error: 'Could not list Chad account rows.', detail: String((err as Error)?.message || err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await chadOnly();
    if ('error' in gate && gate.error) return gate.error;
    const body = (await req.json().catch(() => null)) as { apply?: boolean; restoreBoxes?: boolean; archiveClaudeTests?: boolean; archiveJunkBox?: boolean; importBoxes?: unknown[]; recoverNotes?: boolean } | null;
    if (!body?.apply && !body?.restoreBoxes && !body?.archiveClaudeTests && !body?.archiveJunkBox && !body?.importBoxes && !body?.recoverNotes) return NextResponse.json({ error: 'Send { apply: true } or { restoreBoxes: true } or { recoverNotes: true }.' }, { status: 400 });
    const { sql, owners } = gate as { sql: NonNullable<Awaited<ReturnType<typeof getSql>>>; owners: string[] };
    if (body.recoverNotes) {
      const CLUSTER = 'd1fa61d7-8f49-48d1-b62d-3ffd8bb976fa';
      const recovered = [];
      for (const ownerId of owners) {
        try {
          const beforeLive = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL`;
          const beforeGone = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL`;
          let clusterCreatedVan: string | null = null;
          try {
            const cl = await sql`
              SELECT to_char(created_at AT TIME ZONE 'America/Vancouver', 'YYYY-MM-DD HH24:MI:SS') AS created_van
              FROM note_clusters WHERE id = ${CLUSTER}::uuid LIMIT 1
            `;
            clusterCreatedVan = (cl[0]?.created_van as string) || null;
          } catch { /* cluster missing */ }
          const back = await sql`
            UPDATE notes SET deleted_at = NULL, updated_at = now()
            WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
            RETURNING id::text, title
          `;
          let stickyN = 0;
          try {
            const sticky = await sql`
              UPDATE sticky_notes SET deleted_at = NULL
              WHERE owner_id = ${ownerId} AND deleted_at IS NOT NULL
              RETURNING id::text
            `;
            stickyN = sticky.length;
          } catch { /* sticky_notes may not exist */ }
          const afterLive = await sql`SELECT count(*)::int AS n FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL`;
          const titles = await sql`SELECT title FROM notes WHERE owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 80`;
          const liveN = Number(beforeLive[0]?.n || 0);
          const goneN = Number(beforeGone[0]?.n || 0);
          recovered.push({
            ownerId,
            clusterCreatedVan,
            before: { live: liveN, deleted: goneN },
            restoredNotes: (back as { id?: string; title?: string }[]).map((r) => r.title || r.id),
            restoredSticky: stickyN,
            afterLive: Number(afterLive[0]?.n || 0),
            liveTitles: (titles as { title?: string }[]).map((t) => t.title || ''),
            needPitr: goneN === 0 && liveN <= 5,
            neonApiKey: process.env.NEON_API_KEY || process.env.NEON_API_TOKEN ? 'set' : 'missing',
            pitrBlocked: !(process.env.NEON_API_KEY || process.env.NEON_API_TOKEN),
            plain: goneN === 0
              ? 'No soft-deleted notes remain. Rows were hard-deleted or never soft-deleted. Neon PITR needs NEON_API_KEY in Vercel (missing).'
              : null,
          });
        } catch (err) {
          fail('chad_recover_notes', err);
          recovered.push({ ownerId, error: String((err as Error)?.message || err) });
        }
      }
      return NextResponse.json({ ok: true, recoverNotes: true, recovered });
    }
    if (body.restoreBoxes) {
      const restored = [];
      for (const ownerId of owners) restored.push({ ownerId, ...(await restoreDeletedBoxes(sql, ownerId)) });
      return NextResponse.json({ ok: true, restoreBoxes: true, restored });
    }
    if (body.archiveJunkBox) {
      const archived = [];
      for (const ownerId of owners) archived.push({ ownerId, ...(await archiveJunkBox(sql, ownerId)) });
      return NextResponse.json({ ok: true, archiveJunkBox: true, archived });
    }
    if (Array.isArray(body.importBoxes)) {
      const imported = [];
      for (const ownerId of owners) imported.push({ ownerId, ...(await importSnapshotBoxes(sql, ownerId, body.importBoxes as Record<string, unknown>[])) });
      return NextResponse.json({ ok: true, importBoxes: true, imported });
    }
    if (body.archiveClaudeTests) {
      const archived = [];
      for (const ownerId of owners) archived.push({ ownerId, ...(await archiveClaudeTestItems(sql, ownerId)) });
      return NextResponse.json({ ok: true, archiveClaudeTests: true, archived });
    }
    const result = await applyChadAccountFix(sql, owners);
    return NextResponse.json({ ok: true, applied: true, ...result });
  } catch (err) {
    fail('chad_account_apply', err);
    return NextResponse.json({ error: 'Could not apply Chad account restore.' }, { status: 500 });
  }
}
