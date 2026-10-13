import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { packageIdOk, uploadSpaceFile } from '@/lib/packages';
import { openBoard } from '@/lib/session';
import { addSpaceItem, readSpace } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !packageIdOk(params.id)) {
      return NextResponse.json({ saved: false, error: 'Could not stage that file. The Space is unchanged.' });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ saved: false, error: 'Could not stage that file. The Space is unchanged.' });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const space = await readSpace(session.sql, session.userId, params.id);
    if (space) {
      const added = await addSpaceItem(session.sql, session.userId, params.id, {
        kind: String(form.get('mime') || file.type || '').startsWith('image/') ? 'image' : 'file',
        name: String(form.get('name') || file.name || ''),
        mime: String(form.get('mime') || file.type || ''),
        parentId: String(form.get('folderId') || ''),
      }, bytes);
      if (!added) return NextResponse.json({ saved: false, error: 'Could not stage that file. The Space is unchanged.' });
      return NextResponse.json({ id: params.id, item: added.item, package: added.package || added });
    }
    const staged = await uploadSpaceFile(session.sql, session.userId, params.id, {
      name: String(form.get('name') || file.name || ''),
      mime: String(form.get('mime') || file.type || ''),
      folderId: String(form.get('folderId') || ''),
      bytes,
    });
    if (staged.error || !staged.package) {
      return NextResponse.json({ saved: false, error: staged.error || 'Could not stage that file. The Space is unchanged.' });
    }
    return NextResponse.json(staged.package);
  } catch (err) {
    fail('spaces_upload', err);
    return NextResponse.json({ saved: false, error: 'Could not stage that file. The Space is unchanged.' });
  }
}
