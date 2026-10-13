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
    const type = String(file?.type || '');
    const previewable = type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/');
    if (!file || !file.bytes.length || !previewable) {
      return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    }
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'content-type': type,
        'content-disposition': 'inline',
        'cache-control': 'private, max-age=60',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    fail('drive_file', err);
    return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
  }
}
