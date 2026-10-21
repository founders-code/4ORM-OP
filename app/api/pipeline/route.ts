import { NextResponse } from 'next/server';
import { readPipelineCache } from '@/lib/changes';
import { withCreds } from '@/lib/creds';
import { type GhlPipeline } from '@/lib/ghl';
import { cachePipelines } from '@/lib/live';
import { fail } from '@/lib/log';
import { openBoard, roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ stages: [], pipelines: [], error: '' });
    const ownerId = (await roomOwner(session.sql)) || session.userId;
    let cached = await readPipelineCache(session.sql, ownerId);
    if (!cached) {
      const creds = await loadCredsFor(session.userId);
      await withCreds(creds, () => cachePipelines(session.sql!, ownerId)).catch((err) => fail('pipeline', err));
      cached = await readPipelineCache(session.sql, ownerId);
    }
    const pipelines = (cached?.pipelines || []) as GhlPipeline[];
    const error = pipelines.length ? '' : (cached ? '' : 'GHL sync failed');
    const merged = new Map<string, number>();
    for (const pipe of pipelines) for (const stage of pipe.stages) merged.set(stage.name, (merged.get(stage.name) || 0) + stage.count);
    const stages = [...merged.entries()].map(([stage, count]) => ({ stage, count, detail: count === 1 ? '1 opportunity' : `${count} opportunities` }));
    return NextResponse.json({ stages, pipelines, error });
  } catch (err) {
    fail('pipeline', err);
    return NextResponse.json({ stages: [], pipelines: [], error: 'GHL sync failed' });
  }
}
