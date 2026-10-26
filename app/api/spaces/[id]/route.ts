import { NextResponse } from 'next/server';
import { statusFor } from '@/lib/http';
import { fail } from '@/lib/log';
import { legacyPackageDelete as packageDelete, legacyPackageGet as packageGet, legacyPackagePatch as packagePatch, legacyPackagePost as packagePost } from '@/lib/package-legacy';
import { openBoard, sessionOwner } from '@/lib/session';
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
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    return NextResponse.json({ space: null, items: [], recipients: [], email: { subject: '', body: '' }, package: null }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ id: ctx.params.id, saved: false }, { status: 503 });
    const existing = await spaceOrNull(session.userId, ctx.params.id, session.sql);
    if (!existing) return packagePatch(new Request(req.url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx);
    const saved = await patchSpace(session.sql, session.userId, ctx.params.id, body);
    if (!saved) return NextResponse.json(existing);
    return NextResponse.json(saved);
  } catch (err) {
    fail('spaces_patch', err);
    return NextResponse.json({ id: ctx.params.id, saved: false }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ ok: false }, { status: 503 });
    const existing = await spaceOrNull(session.userId, ctx.params.id, session.sql);
    if (!existing) return packageDelete(req, ctx);
    const ok = await deleteSpace(session.sql, session.userId, ctx.params.id);
    return NextResponse.json({ ok }, ok ? undefined : { status: 404 });
  } catch (err) {
    fail('spaces_delete', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
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
      /* A library file attaches as itself: its stored bytes are copied, and its Drive id is kept when it has one. */
      const stagedId = String(body.stagedId || '');
      if (/^[0-9a-f-]{36}$/i.test(stagedId)) {
        const staged = await sql`
          SELECT name, mime, url, drive_file_id, body_b64 FROM staged_docs
          WHERE id = ${stagedId} AND owner_id = ${session.userId}
          LIMIT 1
        `;
        const doc = staged[0] as { name?: string; mime?: string; url?: string; drive_file_id?: string; body_b64?: string } | undefined;
        if (!doc) return NextResponse.json({ saved: false, error: 'That file is not in the library.' }, { status: 404 });
        const bytes = doc.body_b64 ? Buffer.from(String(doc.body_b64), 'base64') : undefined;
        const mime = String(doc.mime || '');
        const added = await addSpaceItem(sql, session.userId, id, {
          kind: mime.startsWith('image/') ? 'image' : 'file',
          name: String(doc.name || body.name || 'File'),
          mime,
          url: String(doc.url || ''),
          driveFileId: String(doc.drive_file_id || ''),
          parentId: body.folderId || body.parentId,
        }, bytes && bytes.length ? bytes : undefined);
        if (!added) return NextResponse.json({ saved: false, error: 'Could not add that file to the Space.' }, { status: 400 });
        return NextResponse.json(added.package || added);
      }
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
      return NextResponse.json(pushed || { ok: false, package: existing, error: 'Drive could not take this Space. The staged files are still here.' }, statusFor(pushed, 502));
    }
    if (action === 'prepare-send') {
      const sent = await sendSpace(sql, session.userId, id);
      if (!sent) return NextResponse.json({ prepared: false, package: existing, note: 'Could not prepare that send.' }, { status: 500 });
      return NextResponse.json(sent, sent.prepared === false ? { status: 400 } : undefined);
    }
    if (action === 'send-ghl') {
      const sent = await sendSpaceGhl(sql, session.userId, id, {
        docs: body.includeDocs !== false,
        links: body.includeLinks !== false,
        test: body.test === true,
        to: String(body.to || ''),
      });
      if (sent.sent) return NextResponse.json(sent);
      const code = (sent as { code?: string }).code;
      const status = code === 'test_required' ? 409 : code === 'no_recipients' ? 400 : code === 'not_connected' ? 503 : code === 'not_found' ? 404 : 502;
      return NextResponse.json(sent, { status });
    }
    if (action === 'follow-up') {
      const followed = await followSpaceGhl(sql, session.userId, id);
      return NextResponse.json(followed || { ok: false, note: 'Follow up is on the desk.' }, statusFor(followed, 502));
    }
    if (action === 'add-note') {
      const added = await addSpaceItem(sql, session.userId, id, { kind: 'note', name: body.name || 'Note', body: body.body || '', parentId: body.parentId });
      return NextResponse.json(added?.package || added || existing);
    }
    return NextResponse.json(existing);
  } catch (err) {
    fail('spaces_post', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
