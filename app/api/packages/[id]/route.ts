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
  readPackage,
  removeDoc,
  removeRecipient,
  removeSpaceFolder,
} from '@/lib/packages';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !packageIdOk(params.id)) return NextResponse.json({ package: null });
    const pkg = await readPackage(session.sql, session.userId, params.id);
    return NextResponse.json({ package: pkg });
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ package: null });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !packageIdOk(params.id)) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const pkg = await patchPackage(session.sql, session.userId, params.id, body || {});
    if (!pkg) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(pkg);
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    } else return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    if (!pkg) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(pkg);
  } catch (err) {
    fail('packages_failed', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
  }
}
