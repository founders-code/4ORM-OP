import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { driveIdOk, driveThumbnail } from '@/lib/drive-docs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

function image(type: string, bytes: Buffer) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'content-type': type,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'",
    },
  });
}

/** First-page preview for a library card or a Space tile.
 *  ?id=<Drive file id> or ?id=<library uuid>. Drive renders PDFs, Office and Google files;
 *  a stored image is served as itself. Anything else is a 404 and the card keeps its placeholder. */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = String(new URL(req.url).searchParams.get('id') || '');
    let driveId = '';
    if (UUID.test(id)) {
      if (!session.sql) return NextResponse.json({ error: 'No preview' }, { status: 404 });
      const rows = await session.sql`
        SELECT drive_file_id, mime, CASE WHEN mime LIKE 'image/%' THEN body_b64 ELSE NULL END AS body
        FROM staged_docs WHERE id = ${id} AND owner_id = ${session.userId} LIMIT 1
      `;
      const row = rows[0] as { drive_file_id?: string; mime?: string; body?: string } | undefined;
      if (!row) return NextResponse.json({ error: 'No preview' }, { status: 404 });
      driveId = String(row.drive_file_id || '');
      const mime = String(row.mime || '');
      if (!driveIdOk(driveId) && /^image\/(png|jpe?g|gif|webp)$/.test(mime) && row.body) {
        return image(mime, Buffer.from(String(row.body), 'base64'));
      }
    } else if (driveIdOk(id)) {
      driveId = id;
    }
    if (!driveIdOk(driveId)) return NextResponse.json({ error: 'No preview' }, { status: 404 });
    const creds = await loadCredsFor(session.userId);
    const thumb = await withCreds(creds, () => driveThumbnail(driveId));
    if (!thumb) return NextResponse.json({ error: 'No preview' }, { status: 404 });
    return image(thumb.type, thumb.bytes);
  } catch (err) {
    fail('documents_thumb', err);
    return NextResponse.json({ error: 'No preview' }, { status: 404 });
  }
}
