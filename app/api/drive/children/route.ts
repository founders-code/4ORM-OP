import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { claimBudget } from '@/lib/db';
import { listFolderContents } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const empty = { folders: [], files: [] };

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json(empty);
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^[\w-]{8,}$/.test(id)) return NextResponse.json(empty);
    if (!(await claimBudget(session.sql, session.userId, 'google_drive', 1))) {
      return NextResponse.json({ ...empty, error: 'Drive is busy. The tree stays as it was.' });
    }
    const creds = await loadCredsFor(session.userId);
    const listed = await withCreds(creds, () => listFolderContents(id));
    if (!listed) return NextResponse.json({ ...empty, error: 'Drive could not list that folder.' });
    return NextResponse.json(listed);
  } catch (err) {
    fail('drive_children', err);
    return NextResponse.json(empty);
  }
}
