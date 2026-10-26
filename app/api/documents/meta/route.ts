import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { driveFileMeta, driveIdOk, pdfPageCount } from '@/lib/drive-docs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

/** Viewer details for one file: ?id=<library uuid> and/or ?drive=<Drive file id>.
 *  Folder and added date come from the library row; modified and owner from Drive when the file is synced;
 *  pages is counted for a stored PDF (0 when unknown). */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const q = new URL(req.url).searchParams;
    const id = String(q.get('id') || '');
    let drive = String(q.get('drive') || '');
    const out: Record<string, unknown> = { folder: '', mime: '', added: '', modified: '', owner: '', drive: '', pages: 0, stored: false };
    if (UUID.test(id) && session.sql) {
      const rows = await session.sql`
        SELECT category, mime, created_at, drive_file_id,
          CASE WHEN mime = 'application/pdf' THEN body_b64 ELSE NULL END AS pdf,
          (body_b64 IS NOT NULL AND body_b64 <> '') AS stored
        FROM staged_docs WHERE id = ${id} AND owner_id = ${session.userId} LIMIT 1
      `;
      const row = rows[0] as Record<string, unknown> | undefined;
      if (!row) return NextResponse.json({ error: 'Unknown file' }, { status: 404 });
      out.folder = String(row.category || '');
      out.mime = String(row.mime || '');
      out.added = row.created_at ? new Date(String(row.created_at)).toISOString() : '';
      out.stored = row.stored === true;
      if (!drive) drive = String(row.drive_file_id || '');
      if (row.pdf) out.pages = pdfPageCount(Buffer.from(String(row.pdf), 'base64'));
    }
    if (driveIdOk(drive)) {
      const creds = await loadCredsFor(session.userId);
      const meta = await withCreds(creds, () => driveFileMeta(drive));
      if (meta) {
        out.drive = meta.id;
        out.modified = meta.modified;
        out.owner = meta.owner;
        out.mime = out.mime || meta.mime;
      }
    }
    return NextResponse.json(out);
  } catch (err) {
    fail('documents_meta', err);
    return NextResponse.json({ error: 'Could not read that file.' }, { status: 500 });
  }
}
