import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

const CATS = ['Dev', 'VC', 'Angel', 'Friends & Fam', 'Grants', 'Regulator', 'Government', 'Dev Partners', 'Design Partners', 'Banking', 'Legal'];

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ saved: false });
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ saved: false });
    const category = CATS.includes(String(form.get('category') || '')) ? String(form.get('category')) : 'Dev';
    const name = String(form.get('name') || file.name || 'File').slice(0, 180);
    const mime = String(form.get('mime') || file.type || '').slice(0, 120);
    const raw = Buffer.from(await file.arrayBuffer()).toString('base64').slice(0, 1600000);
    await session.sql`
      INSERT INTO staged_docs (owner_id, category, name, mime, body_b64)
      VALUES (${session.userId}, ${category}, ${name}, ${mime}, ${raw})
    `;
    return NextResponse.json({ ok: true, name, category });
  } catch (err) {
    fail('documents_upload', err);
    return NextResponse.json({ saved: false });
  }
}
