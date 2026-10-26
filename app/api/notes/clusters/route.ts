import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { createCluster, listClusters, patchCluster, softDeleteCluster } from '@/lib/note-clusters';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ clusters: [] });
    const clusters = await listClusters(session.sql, session.userId);
    return NextResponse.json({ clusters });
  } catch (err) {
    fail('note_clusters_list', err);
    return NextResponse.json({ clusters: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const row = await createCluster(session.sql, session.userId, body);
    return NextResponse.json(row || { saved: false });
  } catch (err) {
    fail('note_clusters_create', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '');
    if (!ID.test(id)) return NextResponse.json({ error: 'Could not update that cluster.' }, { status: 400 });
    const row = await patchCluster(session.sql, session.userId, id, body);
    if (!row) return NextResponse.json({ error: 'Cluster not found.' }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    fail('note_clusters_patch', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '');
    if (!ID.test(id)) return NextResponse.json({ error: 'Could not hide that cluster.' }, { status: 400 });
    await softDeleteCluster(session.sql, session.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('note_clusters_delete', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
