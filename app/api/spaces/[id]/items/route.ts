import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { addSpaceItem, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ saved: false });
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ saved: false });
      const bytes = Buffer.from(await file.arrayBuffer());
      const added = await addSpaceItem(session.sql, session.userId, params.id, {
        kind: String(form.get('mime') || file.type || '').startsWith('image/') ? 'image' : 'file',
        name: String(form.get('name') || file.name || ''),
        mime: String(form.get('mime') || file.type || ''),
        parentId: String(form.get('parentId') || form.get('folderId') || ''),
      }, bytes);
      if (!added?.item) return NextResponse.json({ saved: false });
      return NextResponse.json({ id: params.id, item: added.item, package: added.package || added });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const added = await addSpaceItem(session.sql, session.userId, params.id, body);
    if (!added) return NextResponse.json({ saved: false });
    return NextResponse.json({ id: params.id, item: added.item, package: added.package || added });
  } catch (err) {
    fail('spaces_item', err);
    return NextResponse.json({ saved: false });
  }
}
