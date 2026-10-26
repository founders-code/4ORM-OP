import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { copyDriveFile, driveWrite, uploadDriveBytes } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

function shape(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    category: String(row.category || ''),
    name: String(row.name || ''),
    url: String(row.url || ''),
    driveFileId: String(row.drive_file_id || ''),
    mime: String(row.mime || ''),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : '',
    stored: row.stored === true,
  };
}

const UUID = /^[0-9a-f-]{36}$/i;
/** Base64 characters a single-request upload may carry (about 3 MB of file, under the 4.5 MB request cap). */
const RAW_CAP = 4_200_000;

function setShape(row: Record<string, unknown>) {
  let ids: unknown = row.doc_ids;
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  return {
    id: String(row.id),
    name: String(row.name || ''),
    docIds: Array.isArray(ids) ? ids.map(String).filter((id) => UUID.test(id)) : [],
  };
}

function idList(value: unknown) {
  return (Array.isArray(value) ? value : []).map(String).filter((id) => UUID.test(id)).slice(0, 500);
}

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'The library is not available right now.' }, { status: 503 });
    const rows = await session.sql`
      SELECT id, category, name, url, drive_file_id, mime, created_at, (body_b64 IS NOT NULL AND body_b64 <> '') AS stored
      FROM staged_docs
      WHERE owner_id = ${session.userId} AND COALESCE(to_jsonb(staged_docs) ->> 'deleted_at', '') = ''
      ORDER BY category, name
    `;
    const docs = (rows as Record<string, unknown>[]).map(shape);
    /* Real folders only: the saved folder rows plus any folder a file already sits in. No seeded names. */
    const folders: string[] = [];
    try {
      const saved = await session.sql`SELECT name FROM doc_folders WHERE owner_id = ${session.userId} ORDER BY name`;
      (saved as Record<string, unknown>[]).forEach((row) => {
        const name = String(row.name || '');
        if (name && !folders.includes(name)) folders.push(name);
      });
    } catch (err) {
      fail('doc_folders', err);
    }
    docs.forEach((doc) => {
      if (doc.category && !folders.includes(doc.category)) folders.push(doc.category);
    });
    let sets: ReturnType<typeof setShape>[] = [];
    try {
      const setRows = await session.sql`
        SELECT id, name, doc_ids FROM doc_sets
        WHERE owner_id = ${session.userId} AND deleted_at IS NULL
        ORDER BY position, created_at
      `;
      sets = (setRows as Record<string, unknown>[]).map(setShape);
    } catch (err) {
      fail('doc_sets', err);
    }
    return NextResponse.json({ docs, categories: folders, folders, sets });
  } catch (err) {
    fail('staged_docs', err);
    return NextResponse.json({ error: 'Could not load the library.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body?.action || '');
    if (action === 'pull') {
      const category = String(body?.category || '').trim().slice(0, 80) || 'Uncategorized';
      const name = String(body?.name || '').trim().slice(0, 180);
      const driveFileId = String(body?.driveFileId || '').trim().slice(0, 120);
      if (!name || !/^[\w-]{8,}$/.test(driveFileId)) return NextResponse.json({ error: 'Pick a Drive file.' }, { status: 400 });
      const found = await session.sql`
        SELECT id FROM staged_docs
        WHERE owner_id = ${session.userId} AND drive_file_id = ${driveFileId}
          AND COALESCE(to_jsonb(staged_docs) ->> 'deleted_at', '') = ''
        LIMIT 1
      `;
      if (found[0]?.id) return NextResponse.json({ ok: true, id: String(found[0].id), existing: true });
      await session.sql`
        INSERT INTO doc_folders (owner_id, name) VALUES (${session.userId}, ${category})
        ON CONFLICT (owner_id, name) DO NOTHING
      `;
      const url = String(body?.url || '').slice(0, 500);
      const inserted = await session.sql`
        INSERT INTO staged_docs (owner_id, category, name, url, drive_file_id, mime)
        VALUES (${session.userId}, ${category}, ${name}, ${/^https:\/\//.test(url) ? url : `https://drive.google.com/file/d/${driveFileId}/view`}, ${driveFileId}, ${String(body?.mime || '').slice(0, 120)})
        RETURNING id
      `;
      return NextResponse.json({ ok: true, id: String(inserted[0]?.id || '') });
    }
    if (action === 'add-set') {
      const name = String(body?.name || '').trim().slice(0, 80);
      if (!name) return NextResponse.json({ error: 'Name the set.' }, { status: 400 });
      const ids = idList(body?.docIds);
      const pos = await session.sql`SELECT COALESCE(MAX(position), 0) + 1 AS n FROM doc_sets WHERE owner_id = ${session.userId}`;
      const rows = await session.sql`
        INSERT INTO doc_sets (owner_id, name, doc_ids, position)
        VALUES (${session.userId}, ${name}, ${JSON.stringify(ids)}::jsonb, ${Number(pos[0]?.n || 1)})
        RETURNING id, name, doc_ids
      `;
      return NextResponse.json({ ok: true, set: setShape(rows[0] as Record<string, unknown>) });
    }
    if (action === 'set-add' || action === 'set-remove-docs' || action === 'rename-set' || action === 'remove-set' || action === 'restore-set') {
      const id = String(body?.id || '');
      if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown set.' }, { status: 400 });
      const rows = await session.sql`SELECT id, name, doc_ids FROM doc_sets WHERE id = ${id} AND owner_id = ${session.userId} LIMIT 1`;
      if (!rows[0]) return NextResponse.json({ error: 'Unknown set.' }, { status: 404 });
      const current = setShape(rows[0] as Record<string, unknown>);
      if (action === 'remove-set' || action === 'restore-set') {
        await session.sql`
          UPDATE doc_sets SET deleted_at = ${action === 'remove-set' ? new Date().toISOString() : null}
          WHERE id = ${id} AND owner_id = ${session.userId}
        `;
        return NextResponse.json({ ok: true, set: current });
      }
      if (action === 'rename-set') {
        const name = String(body?.name || '').trim().slice(0, 80);
        if (!name) return NextResponse.json({ error: 'Name the set.' }, { status: 400 });
        await session.sql`UPDATE doc_sets SET name = ${name} WHERE id = ${id} AND owner_id = ${session.userId}`;
        return NextResponse.json({ ok: true, set: { ...current, name } });
      }
      const ids = idList(body?.docIds);
      const next = action === 'set-add'
        ? current.docIds.concat(ids.filter((d) => !current.docIds.includes(d))).slice(0, 500)
        : current.docIds.filter((d) => !ids.includes(d));
      await session.sql`
        UPDATE doc_sets SET doc_ids = ${JSON.stringify(next)}::jsonb
        WHERE id = ${id} AND owner_id = ${session.userId}
      `;
      return NextResponse.json({ ok: true, set: { ...current, docIds: next } });
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
      raw = raw.replace(/\s/g, '');
      if (!raw) return NextResponse.json({ error: 'That file was empty.' }, { status: 400 });
      if (raw.length > RAW_CAP) return NextResponse.json({ error: 'That file is too big for a direct upload. Use the Drive upload.' }, { status: 413 });
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
      const restore = body?.restore === true;
      await session.sql`
        UPDATE staged_docs SET deleted_at = ${restore ? null : new Date().toISOString()}
        WHERE id = ${id} AND owner_id = ${session.userId}
      `;
      return NextResponse.json({ ok: true, id, restored: restore });
    }
    if (action === 'push') {
      const rows = await session.sql`
        SELECT id, category, name, drive_file_id FROM staged_docs
        WHERE owner_id = ${session.userId} AND COALESCE(to_jsonb(staged_docs) ->> 'deleted_at', '') = ''
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
