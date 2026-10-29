import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { listPipelines } from '@/lib/ghl';
import { withCreds } from '@/lib/creds';
import { loadCredsFor } from '@/lib/vault';
import { growthRecord } from '@/lib/growth';
import { TEST_SEND_TO } from '@/lib/send-gate.mjs';
import {
  listSpacesLite, listStagePackages, previewStageSend, recentSends, removeStagePackage, saveStagePackage, sendStagePackage, stageStats,
} from '@/lib/stage-packages';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { err: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId, userId: session.userId };
}

const SAMPLE = { id: 'sample', list: 'design', name: 'Sample Mortgage Co', contact: 'Chad Johnston', email: TEST_SEND_TO };

export async function GET(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const u = new URL(req.url);
    const stage = String(u.searchParams.get('stage') || '').slice(0, 64);
    if (u.searchParams.get('preview')) {
      const recId = String(u.searchParams.get('record') || '');
      const rec = recId ? ((await growthRecord(g.sql, g.ownerId, recId)) as Record<string, unknown> | null) : SAMPLE;
      if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ preview: await previewStageSend(g.sql, g.ownerId, rec, stage, g.userId) });
    }
    if (u.searchParams.get('packages')) {
      const list = await listStagePackages(g.sql, g.ownerId);
      return NextResponse.json({ packages: list.map((p) => ({ stageId: p.stageId, stageName: p.stageName, pipelineId: p.pipelineId, subject: p.subject, active: p.active, docs: p.docs.length })) });
    }
    if (u.searchParams.get('sends')) return NextResponse.json({ sends: await recentSends(g.sql, g.ownerId, stage) });
    const creds = await loadCredsFor(g.userId);
    const [pipes, packages, stats, spaces] = await Promise.all([
      withCreds(creds, () => listPipelines()).catch(() => ({ status: 'unavailable' as const, pipelines: [] })),
      listStagePackages(g.sql, g.ownerId),
      stageStats(g.sql, g.ownerId),
      listSpacesLite(g.sql, g.userId),
    ]);
    const pipelines = (pipes.pipelines || []).map((p) => ({
      id: p.id, name: p.name, total: p.total,
      stages: p.stages.map((st) => ({ id: st.id, name: st.name, count: st.count })),
    }));
    return NextResponse.json({ connected: pipes.status !== 'unavailable', pipelines, packages, stats, spaces, testTo: TEST_SEND_TO });
  } catch (err) {
    fail('processes_get', err);
    return NextResponse.json({ error: 'Could not load' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (b.action === 'save') return NextResponse.json({ ok: true, package: await saveStagePackage(g.sql, g.ownerId, b) });
    if (b.action === 'remove' || b.action === 'restore') {
      await removeStagePackage(g.sql, g.ownerId, String(b.stageId || ''), b.action === 'restore');
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'test') {
      /* A test only ever goes to Chad's own address. */
      const creds = await loadCredsFor(g.userId);
      const out = await withCreds(creds, () => sendStagePackage(g.sql, g.ownerId, SAMPLE, String(b.stageId || ''), { test: true, testTo: TEST_SEND_TO, spaceOwner: g.userId }));
      return out.ok ? NextResponse.json({ ok: true, to: TEST_SEND_TO }) : NextResponse.json({ error: out.note }, { status: 502 });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    fail('processes_post', err);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
