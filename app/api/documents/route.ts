import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { copyDriveFile, driveWrite, uploadDriveBytes } from '@/lib/google';
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
    let folders = CATS.slice();
    try {
      const saved = await session.sql`SELECT name FROM doc_folders WHERE owner_id = ${session.userId} ORDER BY name`;
      if (!saved.length) {
        for (const name of CATS) {
          await session.sql`
            INSERT INTO doc_folders (owner_id, name)
            VALUES (${session.userId}, ${name})
            ON CONFLICT (owner_id, name) DO NOTHING
          `;
        }
      } else {
        folders = (saved as Record<string, unknown>[]).map((row) => String(row.name || '')).filter(Boolean);
      }
    } catch (err) {
      fail('doc_folders', err);
    }
    return NextResponse.json({ docs: (rows as Record<string, unknown>[]).map(shape), categories: folders, folders });
  } catch (err) {
    fail('staged_docs', err);
    return NextResponse.json({ docs: [], categories: CATS });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ saved: false });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body?.action || '');
    if (action === 'pull') {
      const category = String(body?.category || '').trim().slice(0, 80);
      const name = String(body?.name || '').trim().slice(0, 180);
      if (!category || !name) return NextResponse.json({ error: 'Pick a folder and a file.' }, { status: 400 });
      await session.sql`
        INSERT INTO staged_docs (owner_id, category, name, url, drive_file_id, mime)
        VALUES (${session.userId}, ${category}, ${name}, ${String(body?.url || '').slice(0, 500)}, ${String(body?.driveFileId || '').slice(0, 120)}, ${String(body?.mime || '').slice(0, 120)})
      `;
      return NextResponse.json({ ok: true });
    }
    if (action === 'add-folder' || action === 'rename-folder' || action === 'remove-folder') {
      const name = String(body?.name || '').trim().slice(0, 80);
      const from = String(body?.from || '').trim().slice(0, 80);
      if (action === 'add-folder' && name) {
        await session.sql`
          INSERT INTO doc_folders (owner_id, name)
          VALUES (${session.userId}, ${name})
          ON CONFLICT (owner_id, name) DO NOTHING
        `;
      }
      if (action === 'rename-folder' && from && name && from !== name) {
        await session.sql`
          UPDATE staged_docs SET category = ${name}
          WHERE owner_id = ${session.userId} AND category = ${from}
        `;
        await session.sql`
          UPDATE doc_folders SET name = ${name}
          WHERE owner_id = ${session.userId} AND name = ${from}
        `;
      }
      if (action === 'remove-folder' && name) {
        await session.sql`
          UPDATE staged_docs SET category = 'Uncategorized'
          WHERE owner_id = ${session.userId} AND category = ${name}
        `;
        await session.sql`
          INSERT INTO doc_folders (owner_id, name)
          VALUES (${session.userId}, 'Uncategorized')
          ON CONFLICT (owner_id, name) DO NOTHING
        `;
        await session.sql`
          DELETE FROM doc_folders
          WHERE owner_id = ${session.userId} AND name = ${name} AND name <> 'Uncategorized'
        `;
      }
      return NextResponse.json({ ok: true, name: name || from });
    }
    if (action === 'move') {
      const id = String(body?.id || '');
      const category = String(body?.category || '').trim().slice(0, 80);
      if (!/^[0-9a-f-]{36}$/i.test(id) || !category) return NextResponse.json({ ok: false });
      await session.sql`
        UPDATE staged_docs SET category = ${category}
        WHERE id = ${id} AND owner_id = ${session.userId}
      `;
      return NextResponse.json({ ok: true, id, category });
    }
    const uploadLike = action === 'upload' || (!action && (body?.dataUrl || body?.body || body?.name));
    if (uploadLike) {
      const category = String(body?.category || '').trim().slice(0, 80) || 'Dev';
      const name = String(body?.name || 'File').trim().slice(0, 180) || 'File';
      let mime = String(body?.mime || '').slice(0, 120);
      let raw = String(body?.dataUrl || body?.body || '');
      const packed = raw.match(/^data:([^;]+);base64,(.+)$/);
      if (packed) {
        mime = mime || packed[1].slice(0, 120);
        raw = packed[2];
      }
      raw = raw.slice(0, 1600000);
      if (!raw) return NextResponse.json({ saved: false, name, category });
      let driveFileId = '';
      let url = '';
      const office = /officedocument|msword|ms-excel|ms-powerpoint/.test(mime);
      if (office) {
        try {
          const cached = await session.sql`SELECT tree FROM drive_cache WHERE owner_id = ${session.userId}`;
          let tree: unknown = cached[0]?.tree;
          if (typeof tree === 'string') {
            try { tree = JSON.parse(tree); } catch { tree = []; }
          }
          const parent = String((Array.isArray(tree) ? tree[0] : null)?.id || '');
          if (/^[\w-]{8,}$/.test(parent)) {
            const creds = await loadCredsFor(session.userId);
            const uploaded = (await withCreds(creds, () => uploadDriveBytes(name, mime, parent, Buffer.from(raw, 'base64')))) as { id?: string; webViewLink?: string } | null;
            driveFileId = String(uploaded?.id || '');
            url = driveFileId ? String(uploaded?.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`) : '';
          }
        } catch (err) {
          fail('staged_drive', err);
        }
      }
      try {
        await session.sql`
          INSERT INTO staged_docs (owner_id, category, name, url, drive_file_id, mime, body_b64)
          VALUES (${session.userId}, ${category}, ${name}, ${url}, ${driveFileId}, ${mime}, ${raw})
        `;
      } catch (err) {
        fail('staged_upload', err);
        await session.sql`
          INSERT INTO staged_docs (owner_id, category, name, mime)
          VALUES (${session.userId}, ${category}, ${name}, ${String(body?.mime || '').slice(0, 120)})
        `;
      }
      return NextResponse.json({ ok: true, name, category });
    }
    if (action === 'remove') {
      const id = String(body?.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Could not remove that file.' }, { status: 400 });
      await session.sql`DELETE FROM staged_docs WHERE id = ${id} AND owner_id = ${session.userId}`;
      return NextResponse.json({ ok: true });
    }
    if (action === 'push') {
      const rows = await session.sql`
        SELECT id, category, name, drive_file_id FROM staged_docs
        WHERE owner_id = ${session.userId}
          AND (${String(body?.category || '').trim().slice(0, 80)} = '' OR category = ${String(body?.category || '').trim().slice(0, 80)})
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
    return NextResponse.json({ ok: false });
  } catch (err) {
    fail('staged_docs', err);
    return NextResponse.json({ saved: false });
  }
}
