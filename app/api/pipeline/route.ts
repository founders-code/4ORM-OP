import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { listPipelines, type GhlPipeline } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ stages: [], pipelines: [], error: '' });
    const creds = await loadCredsFor(session.userId);
    let pipelines: GhlPipeline[] = [];
    let error = '';
    try {
      const pipe = await withCreds(creds, () => listPipelines());
      pipelines = pipe?.pipelines || [];
      if (!pipe || pipe.status === 'unavailable') error = 'GHL sync failed';
    } catch (err) {
      fail('pipeline', err);
      error = 'GHL sync failed';
    }
    const merged = new Map<string, number>();
    for (const pipe of pipelines) for (const stage of pipe.stages) merged.set(stage.name, (merged.get(stage.name) || 0) + stage.count);
    const stages = [...merged.entries()].map(([stage, count]) => ({ stage, count, detail: count === 1 ? '1 opportunity' : `${count} opportunities` }));
    return NextResponse.json({ stages, pipelines, error });
  } catch (err) {
    fail('pipeline', err);
    return NextResponse.json({ stages: [], pipelines: [], error: 'GHL sync failed' });
  }
}
