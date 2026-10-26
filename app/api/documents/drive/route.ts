import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { driveSearch } from '@/lib/drive-docs';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

/** Pull from Drive picker: GET ?q=<name text>. Newest Drive files when q is empty. */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const q = String(new URL(req.url).searchParams.get('q') || '');
    const creds = await loadCredsFor(session.userId);
    const files = await withCreds(creds, () => driveSearch(q));
    if (!files) return NextResponse.json({ error: 'Drive is not connected.' }, { status: 503 });
    return NextResponse.json({ files });
  } catch (err) {
    fail('documents_drive_search', err);
    return NextResponse.json({ error: 'Could not search Drive.' }, { status: 502 });
  }
}
