/**
 * Legacy package handlers. /api/packages/** is retired (it now redirects to /api/spaces/**); the spaces routes
 * still read through to these for Spaces that only exist in the old packages table, so no data is lost.
 * Each handler keeps its own sign-in and sessionOwner() allowlist check.
 */
import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import {
  addDoc,
  addRecipient,
  addSpaceFolder,
  bindFolder,
  createFolder,
  packageIdOk,
  patchPackage,
  prepareSend,
  pushSpace,
  deletePackage,
  readPackage,
  removeDoc,
  removeRecipient,
  removeSpaceFolder,
} from '@/lib/packages';
import { openBoard, sessionOwner } from '@/lib/session';

export async function legacyPackageGet(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !packageIdOk(params.id)) return NextResponse.json({ package: null });
    const pkg = await readPackage(session.sql, session.userId, params.id);
    return NextResponse.json({ package: pkg });
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ package: null }, { status: 500 });
  }
}

export async function legacyPackagePatch(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !packageIdOk(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const pkg = await patchPackage(session.sql, session.userId, params.id, body || {});
    if (!pkg) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(pkg);
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

export async function legacyPackagePost(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !packageIdOk(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = String(body?.action || '');
    const sql = session.sql;
    const id = params.id;
    let pkg = null;
    if (action === 'bind-folder') pkg = await bindFolder(sql, session.userId, id, String(body?.driveFolderId || ''), String(body?.driveFolderUrl || ''));
    else if (action === 'create-folder') pkg = await createFolder(sql, session.userId, id, String(body?.name || ''), String(body?.parentId || ''));
    else if (action === 'add-doc') pkg = await addDoc(sql, session.userId, id, body || {});
    else if (action === 'remove-doc') pkg = await removeDoc(sql, session.userId, id, String(body?.docId || ''));
    else if (action === 'add-folder') pkg = await addSpaceFolder(sql, session.userId, id, String(body?.name || ''), String(body?.parentId || ''));
    else if (action === 'remove-folder') pkg = await removeSpaceFolder(sql, session.userId, id, String(body?.folderId || ''));
    else if (action === 'push-drive') {
      const pushed = await pushSpace(sql, session.userId, id);
      if (!pushed) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      return NextResponse.json(pushed);
    }
    else if (action === 'add-recipient') pkg = await addRecipient(sql, session.userId, id, body || {});
    else if (action === 'remove-recipient') pkg = await removeRecipient(sql, session.userId, id, String(body?.recipientId || ''));
    else if (action === 'prepare-send') {
      const sent = await prepareSend(sql, session.userId, id);
      if (!sent) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
      return NextResponse.json(sent);
    } else if (action === 'add-link') {
      pkg = await addDoc(sql, session.userId, id, { name: String(body?.name || body?.url || 'Link'), url: String(body?.url || ''), mime: 'text/uri-list' });
    } else return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!pkg) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(pkg);
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

export async function legacyPackageDelete(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql || !packageIdOk(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const ok = await deletePackage(session.sql, session.userId, params.id);
    return NextResponse.json({ ok }, ok ? undefined : { status: 404 });
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
