import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { DELETE as packageDelete, GET as packageGet, PATCH as packagePatch, POST as packagePost } from '../../packages/[id]/route';
import { openBoard } from '@/lib/session';
import {
  addSpaceFolder,
  addSpaceItem,
  addSpaceRecipient,
  deleteSpace,
  deleteSpaceItem,
  deleteSpaceRecipient,
  followSpaceGhl,
  listSpaceRecipient,
  moveSpaceToDrive,
  patchSpace,
  readSpace,
  sendSpace,
  sendSpaceGhl,
  spaceIdOk,
} from '@/lib/spaces';

export const dynamic = 'force-dynamic';

async function spaceOrNull(ownerId: string, id: string, sql: NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']) {
  if (!sql || !spaceIdOk(id)) return null;
  return readSpace(sql, ownerId, id);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ space: null, items: [], recipients: [], email: { subject: '', body: '' }, package: null });
    const view = await spaceOrNull(session.userId, ctx.params.id, session.sql);
    if (view) {
      const pack = { ...view };
      return NextResponse.json({
        space: view.space,
        items: view.items,
        recipients: view.recipients,
        email: view.email,
        package: pack,
        id: view.id,
      });
    }
    return packageGet(req, ctx);
  } catch (err) {
    fail('spaces_read', err);
    return NextResponse.json({ space: null, items: [], recipients: [], email: { subject: '', body: '' }, package: null });
  }
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ id: ctx.params.id, saved: false });
    const existing = await spaceOrNull(session.userId, ctx.params.id, session.sql);
    if (!existing) return packagePatch(new Request(req.url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx);
    const saved = await patchSpace(session.sql, session.userId, ctx.params.id, body);
    if (!saved) return NextResponse.json(existing);
    return NextResponse.json(saved);
  } catch (err) {
    fail('spaces_patch', err);
    return NextResponse.json({ id: ctx.params.id, saved: false });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ ok: false });
    const existing = await spaceOrNull(session.userId, ctx.params.id, session.sql);
    if (!existing) return packageDelete(req, ctx);
    const ok = await deleteSpace(session.sql, session.userId, ctx.params.id);
    return NextResponse.json({ ok });
  } catch (err) {
    fail('spaces_delete', err);
    return NextResponse.json({ ok: false });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ saved: false });
    const existing = await spaceOrNull(session.userId, ctx.params.id, session.sql);
    if (!existing) {
      return packagePost(new Request(req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx);
    }
    const sql = session.sql;
    const id = ctx.params.id;
    const action = String(body.action || '');
    if (action === 'add-link') {
      const added = await addSpaceItem(sql, session.userId, id, { kind: 'link', name: body.name || body.url || 'Link', url: body.url, mime: 'text/uri-list', parentId: body.parentId || body.folderId });
      return NextResponse.json(added?.package || added || existing);
    }
    if (action === 'add-doc') {
      const added = await addSpaceItem(sql, session.userId, id, { kind: 'file', ...body, parentId: body.folderId || body.parentId });
      return NextResponse.json(added?.package || added || existing);
    }
    if (action === 'add-folder') {
      const added = await addSpaceFolder(sql, session.userId, id, String(body.name || 'Untitled folder'), String(body.parentId || ''));
      return NextResponse.json(added?.package || added || existing);
    }
    if (action === 'remove-doc' || action === 'remove-folder') {
      const removed = await deleteSpaceItem(sql, session.userId, id, String(body.docId || body.folderId || ''));
      return NextResponse.json(removed || existing);
    }
    if (action === 'add-recipient') {
      const added = await addSpaceRecipient(sql, session.userId, id, body);
      return NextResponse.json(added || existing);
    }
    if (action === 'remove-recipient') {
      const removed = await deleteSpaceRecipient(sql, session.userId, id, String(body.recipientId || ''));
      return NextResponse.json(removed || existing);
    }
    if (action === 'list-recipient') {
      const listed = await listSpaceRecipient(sql, session.userId, id, String(body.recipientId || ''));
      return NextResponse.json(listed || existing);
    }
    if (action === 'push-drive') {
      const pushed = await moveSpaceToDrive(sql, session.userId, id);
      return NextResponse.json(pushed || { ok: false, package: existing, error: 'Drive could not take this Space. The staged files are still here.' });
    }
    if (action === 'prepare-send') {
      const sent = await sendSpace(sql, session.userId, id);
      return NextResponse.json(sent || { prepared: false, package: existing, note: 'Could not prepare that send.' });
    }
    if (action === 'send-ghl') {
      const sent = await sendSpaceGhl(sql, session.userId, id, {
        docs: body.includeDocs !== false,
        links: body.includeLinks !== false,
      });
      return NextResponse.json(sent || { sent: false, note: 'GoHighLevel did not send that.', package: existing });
    }
    if (action === 'follow-up') {
      const followed = await followSpaceGhl(sql, session.userId, id);
      return NextResponse.json(followed || { ok: false, note: 'Follow up is on the desk.' });
    }
    if (action === 'add-note') {
      const added = await addSpaceItem(sql, session.userId, id, { kind: 'note', name: body.name || 'Note', body: body.body || '', parentId: body.parentId });
      return NextResponse.json(added?.package || added || existing);
    }
    return NextResponse.json(existing);
  } catch (err) {
    fail('spaces_post', err);
    return NextResponse.json({ saved: false });
  }
}
