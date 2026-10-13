import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { copyDriveFile, driveWrite } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const CATS = ['Dev', 'VC', 'Angel', 'Friends & Fam', 'Grants', 'Regulator', 'Government', 'Dev Partners', 'Design Partners', 'Banking', 'Legal'];

function shape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    category: String(row.category || ''),
    name: String(row.name || ''),
    url: String(row.url || ''),
    driveFileId: String(row.drive_file_id || ''),
    mime: String(row.mime || ''),
  };
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ docs: [], categories: CATS });
    const rows = await session.sql`
      SELECT id, category, name, url, drive_file_id, mime
      FROM staged_docs
      WHERE owner_id = ${session.userId}
      ORDER BY category, name
    `;
    return NextResponse.json({ docs: (rows as Record<string, unknown>[]).map(shape), categories: CATS });
  } catch (err) {
    fail('staged_docs', err);
    return NextResponse.json({ docs: [], categories: CATS });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ error: 'Could not update the library.' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const action = String(body?.action || '');
    if (action === 'pull') {
      const category = CATS.includes(String(body?.category || '')) ? String(body.category) : '';
      const name = String(body?.name || '').trim().slice(0, 180);
      if (!category || !name) return NextResponse.json({ error: 'Pick a category and a file.' }, { status: 400 });
      await session.sql`
        INSERT INTO staged_docs (owner_id, category, name, url, drive_file_id, mime)
        VALUES (${session.userId}, ${category}, ${name}, ${String(body?.url || '').slice(0, 500)}, ${String(body?.driveFileId || '').slice(0, 120)}, ${String(body?.mime || '').slice(0, 120)})
      `;
      return NextResponse.json({ ok: true });
    }
    if (action === 'remove') {
      const id = String(body?.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Could not remove that file.' }, { status: 400 });
      await session.sql`DELETE FROM staged_docs WHERE id = ${id} AND owner_id = ${session.userId}`;
      return NextResponse.json({ ok: true });
    }
    if (action === 'push') {
      const rows = await session.sql`
        SELECT id, category, name, drive_file_id FROM staged_docs WHERE owner_id = ${session.userId}
      `;
      const creds = await loadCredsFor(session.userId);
      const cached = await session.sql`SELECT tree FROM drive_cache WHERE owner_id = ${session.userId}`;
      let raw: unknown = cached[0]?.tree;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = []; }
      }
      const parent = String((Array.isArray(raw) ? raw[0] : null)?.id || '');
      if (!/^[\w-]{8,}$/.test(parent)) {
        return NextResponse.json({ ok: false, error: 'Drive has no shared drive to receive these files. The library is unchanged.' });
      }
      const folders: Record<string, string> = {};
      let failed = false;
      for (const row of rows as Record<string, unknown>[]) {
        const category = String(row.category || 'Documents');
        const fileId = String(row.drive_file_id || '');
        if (!folders[category]) {
          const folder = (await withCreds(creds, () => driveWrite('mkdir', { name: category, parentId: parent }))) as { id?: string } | null;
          folders[category] = String(folder?.id || '');
        }
        if (!folders[category] || !/^[\w-]{8,}$/.test(fileId)) {
          failed = true;
          continue;
        }
        const copied = await withCreds(creds, () => copyDriveFile(fileId, folders[category], String(row.name || 'File')));
        if (!copied) failed = true;
      }
      if (failed) return NextResponse.json({ ok: false, error: 'Drive did not take every file. The library is unchanged.' });
      return NextResponse.json({ ok: true, error: '' });
    }
    return NextResponse.json({ error: 'Could not update the library.' }, { status: 400 });
  } catch (err) {
    fail('staged_docs', err);
    return NextResponse.json({ error: 'Could not update the library.' }, { status: 400 });
  }
}
