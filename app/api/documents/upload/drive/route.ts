import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { putChunk, startResumable } from '@/lib/drive-docs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
/** Drive chunks must be multiples of 256 KiB; 2 MiB keeps each request well under the 4.5 MB body cap. */
const CHUNK = 2 * 1024 * 1024;
const MAX_FILE = 500 * 1024 * 1024;

type Sql = NonNullable<NonNullable<Awaited<ReturnType<typeof openBoard>>>['sql']>;

async function driveParent(sql: Sql, userId: string) {
  const cached = await sql`SELECT tree FROM drive_cache WHERE owner_id = ${userId}`;
  let tree: unknown = (cached[0] as { tree?: unknown } | undefined)?.tree;
  if (typeof tree === 'string') {
    try { tree = JSON.parse(tree); } catch { tree = []; }
  }
  const parent = String((Array.isArray(tree) ? (tree[0] as { id?: string } | null) : null)?.id || '');
  return /^[\w-]{8,}$/.test(parent) ? parent : '';
}

/** Start a chunked upload: JSON {name, mime, size, category}. Returns {id, chunk}. */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'The library is not available right now.' }, { status: 503 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name || '').trim().slice(0, 180) || 'File';
    const mime = String(body.mime || '').slice(0, 120) || 'application/octet-stream';
    const size = Math.floor(Number(body.size) || 0);
    const category = String(body.category || '').trim().slice(0, 80) || 'Uncategorized';
    if (!(size > 0) || size > MAX_FILE) return NextResponse.json({ error: 'That file size is not supported.' }, { status: 413 });
    const parent = await driveParent(session.sql, session.userId);
    if (!parent) {
      return NextResponse.json({ error: 'Files over 3 MB go to Drive, and Drive is not connected yet. Connect Google in Integrations.' }, { status: 409 });
    }
    const creds = await loadCredsFor(session.userId);
    const sessionUrl = await withCreds(creds, () => startResumable(name, mime, size, parent));
    if (!sessionUrl) return NextResponse.json({ error: 'Drive did not open an upload. Try again.' }, { status: 502 });
    const rows = await session.sql`
      INSERT INTO doc_uploads (owner_id, session_url, name, mime, size, category)
      VALUES (${session.userId}, ${sessionUrl}, ${name}, ${mime}, ${size}, ${category})
      RETURNING id
    `;
    return NextResponse.json({ id: String(rows[0]?.id || ''), chunk: CHUNK });
  } catch (err) {
    fail('documents_upload_start', err);
    return NextResponse.json({ error: 'Could not start that upload.' }, { status: 500 });
  }
}

/** Send one chunk: PUT ?id=<upload id>&offset=<byte offset>, raw bytes as the body. */
export async function PUT(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'The library is not available right now.' }, { status: 503 });
    const q = new URL(req.url).searchParams;
    const id = String(q.get('id') || '');
    const offset = Math.floor(Number(q.get('offset')) || 0);
    if (!UUID.test(id) || offset < 0) return NextResponse.json({ error: 'Unknown upload.' }, { status: 400 });
    const rows = await session.sql`
      SELECT session_url, name, mime, size, category, done FROM doc_uploads
      WHERE id = ${id} AND owner_id = ${session.userId} AND created_at > now() - interval '1 day'
      LIMIT 1
    `;
    const up = rows[0] as { session_url?: string; name?: string; mime?: string; size?: number | string; category?: string; done?: boolean } | undefined;
    if (!up || up.done) return NextResponse.json({ error: 'Unknown upload.' }, { status: 404 });
    const total = Number(up.size || 0);
    const bytes = Buffer.from(await req.arrayBuffer());
    const last = offset + bytes.length >= total;
    if (!bytes.length || bytes.length > CHUNK || offset + bytes.length > total || (!last && bytes.length % (256 * 1024) !== 0)) {
      return NextResponse.json({ error: 'That part of the file did not fit.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    const sent = await withCreds(creds, () => putChunk(String(up.session_url || ''), bytes, offset, total));
    if (!sent) return NextResponse.json({ error: 'Drive did not take that part. Try again.' }, { status: 502 });
    if (!sent.done) return NextResponse.json({ done: false, next: sent.next });
    await session.sql`UPDATE doc_uploads SET done = true WHERE id = ${id} AND owner_id = ${session.userId}`;
    const category = String(up.category || 'Uncategorized');
    await session.sql`
      INSERT INTO doc_folders (owner_id, name) VALUES (${session.userId}, ${category})
      ON CONFLICT (owner_id, name) DO UPDATE SET deleted_at = NULL
    `;
    const url = sent.url || `https://drive.google.com/file/d/${sent.id}/view`;
    const inserted = await session.sql`
      INSERT INTO staged_docs (owner_id, category, name, url, drive_file_id, mime)
      VALUES (${session.userId}, ${category}, ${String(up.name || 'File')}, ${url}, ${sent.id}, ${String(up.mime || '')})
      RETURNING id
    `;
    return NextResponse.json({ done: true, id: String(inserted[0]?.id || ''), driveFileId: sent.id });
  } catch (err) {
    fail('documents_upload_chunk', err);
    return NextResponse.json({ error: 'Could not send that part.' }, { status: 500 });
  }
}
