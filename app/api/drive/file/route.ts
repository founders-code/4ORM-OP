import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { exportDriveFile } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!session.sql || !/^[\w-]{8,}$/.test(id)) {
      return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    }
    const creds = await loadCredsFor(session.userId);
    const file = await withCreds(creds, () => exportDriveFile(id));
    if (!file || !file.bytes.length) {
      return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    }
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'content-disposition': 'inline',
        'cache-control': 'private, max-age=60',
      },
    });
  } catch (err) {
    fail('drive_file', err);
    return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
  }
}
