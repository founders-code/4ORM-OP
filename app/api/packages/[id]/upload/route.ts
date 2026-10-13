import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { packageIdOk, uploadSpaceFile } from '@/lib/packages';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !packageIdOk(params.id)) {
      return NextResponse.json({ error: 'Could not stage that file. The Space is unchanged.' }, { status: 400 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Could not stage that file. The Space is unchanged.' }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const staged = await uploadSpaceFile(session.sql, session.userId, params.id, {
      name: String(form.get('name') || file.name || ''),
      mime: String(form.get('mime') || file.type || ''),
      folderId: String(form.get('folderId') || ''),
      bytes,
    });
    if (staged.error || !staged.package) {
      return NextResponse.json({ error: staged.error || 'Could not stage that file. The Space is unchanged.' }, { status: 400 });
    }
    return NextResponse.json(staged.package);
  } catch (err) {
    fail('packages_upload', err);
    return NextResponse.json({ error: 'Could not stage that file. The Space is unchanged.' }, { status: 400 });
  }
}
