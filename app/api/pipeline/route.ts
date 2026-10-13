import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { listPipeline } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ stages: [], contacts: [], error: '' });
    const creds = await loadCredsFor(session.userId);
    let stages: Array<{ stage: string; count: number; detail: string }> = [];
    let error = '';
    try {
      const pipe = await withCreds(creds, () => listPipeline());
      stages = pipe?.stages || [];
      if (!pipe || pipe.status === 'unavailable') error = 'GHL sync failed';
    } catch (err) {
      fail('pipeline', err);
      error = 'GHL sync failed';
    }
    return NextResponse.json({ stages, error });
  } catch (err) {
    fail('pipeline', err);
    return NextResponse.json({ stages: [], error: 'GHL sync failed' });
  }
}
