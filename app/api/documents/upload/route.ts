import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { uploadDriveBytes } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

type Sql = NonNullable<NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']>;

async function fileOffice(
  sql: Sql,
  userId: string,
  name: string,
  mime: string,
  raw: string,
) {
  if (!/officedocument|msword|ms-excel|ms-powerpoint/.test(mime)) return { driveFileId: '', url: '' };
  try {
    const cached = await sql`SELECT tree FROM drive_cache WHERE owner_id = ${userId}`;
    let tree: unknown = (cached[0] as { tree?: unknown } | undefined)?.tree;
    if (typeof tree === 'string') {
      try { tree = JSON.parse(tree); } catch { tree = []; }
    }
    const parent = String((Array.isArray(tree) ? (tree[0] as { id?: string } | null) : null)?.id || '');
    if (!/^[\w-]{8,}$/.test(parent)) return { driveFileId: '', url: '' };
    const creds = await loadCredsFor(userId);
    const uploaded = (await withCreds(creds, () => uploadDriveBytes(name, mime, parent, Buffer.from(raw, 'base64')))) as { id?: string } | null;
    const driveFileId = String(uploaded?.id || '');
    return { driveFileId, url: driveFileId ? `https://drive.google.com/file/d/${driveFileId}/preview` : '' };
  } catch (err) {
    fail('staged_drive', err);
    return { driveFileId: '', url: '' };
  }
}

async function store(
  sql: Sql,
  userId: string,
  category: string,
  name: string,
  mime: string,
  raw: string,
) {
  if (!sql || !raw) return false;
  const filed = await fileOffice(sql, userId, name, mime, raw);
  await sql`
    INSERT INTO staged_docs (owner_id, category, name, url, drive_file_id, mime, body_b64)
    VALUES (${userId}, ${category}, ${name}, ${filed.url}, ${filed.driveFileId}, ${mime}, ${raw})
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
