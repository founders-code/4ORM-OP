import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function store(
  sql: NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql'],
  userId: string,
  category: string,
  name: string,
  mime: string,
  raw: string,
) {
  if (!sql || !raw) return false;
  await sql`
    INSERT INTO staged_docs (owner_id, category, name, mime, body_b64)
    VALUES (${userId}, ${category}, ${name}, ${mime}, ${raw})
  `;
  return true;
}

function fromDataUrl(value: string, mime: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { mime, raw: value.replace(/\s/g, '').slice(0, 1600000) };
  return { mime: mime || match[1].slice(0, 120), raw: match[2].slice(0, 1600000) };
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ saved: false });
    const type = req.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const category = String(body.category || '').trim().slice(0, 80) || 'Dev';
      const name = String(body.name || 'File').slice(0, 180) || 'File';
      const parsed = fromDataUrl(String(body.dataUrl || body.body || ''), String(body.mime || '').slice(0, 120));
      const saved = await store(session.sql, session.userId, category, name, parsed.mime, parsed.raw);
      return NextResponse.json(saved ? { ok: true, name, category } : { saved: false, name, category });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ saved: false });
    const category = String(form.get('category') || '').trim().slice(0, 80) || 'Dev';
    const name = String(form.get('name') || file.name || 'File').slice(0, 180);
    const mime = String(form.get('mime') || file.type || '').slice(0, 120);
    const raw = Buffer.from(await file.arrayBuffer()).toString('base64').slice(0, 1600000);
    const saved = await store(session.sql, session.userId, category, name, mime, raw);
    return NextResponse.json(saved ? { ok: true, name, category } : { saved: false, name, category });
  } catch (err) {
    fail('documents_upload', err);
    return NextResponse.json({ saved: false });
  }
}
