import { NextResponse } from 'next/server';
import { readPipelineCache } from '@/lib/changes';
import { withCreds } from '@/lib/creds';
import { ensureGhlContact, type GhlPipeline, moveOpportunityStage, pushOpportunity } from '@/lib/ghl';
import { cachePipelines } from '@/lib/live';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ stages: [], pipelines: [], error: '' });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id || '').trim();
    const stage = String(body.stage || body.pipelineStage || '').trim();
    const opportunityId = String(body.opportunityId || '').trim();
    if (opportunityId) {
      // Stage move of an existing opportunity: move it or report why not. Never create a new opportunity.
      const credsMove = await loadCredsFor(session.userId);
      const moved = await withCreds(credsMove, () => moveOpportunityStage({
        opportunityId,
        pipelineId: String(body.pipelineId || ''),
        stageId: String(body.stageId || ''),
        stage,
      }));
      if (moved.ok) return NextResponse.json({ ok: true, opportunityId: moved.opportunityId });
      return NextResponse.json({ ok: false, note: moved.note }, { status: moved.status });
    }
    let name = String(body.name || '').trim().slice(0, 120);
    let email = String(body.email || '').trim().slice(0, 180);
    if (!stage) return NextResponse.json({ ok: false, note: 'Pick a stage' }, { status: 400 });
    const creds = await loadCredsFor(session.userId);
    let sourceId = String(body.ghlId || body.contactId || '');
    if (session.sql && id) {
      const rows = await session.sql`
        SELECT name, email, source, source_id FROM contacts
        WHERE id = ${id} AND owner_id = ${session.userId}
        LIMIT 1
      `;
      const row = rows[0] as { name?: string; email?: string; source?: string; source_id?: string } | undefined;
      if (row?.source === 'ghl' && row.source_id) sourceId = String(row.source_id);
      if (!name && row?.name) name = String(row.name);
      if (!email && row?.email) email = String(row.email);
    }
    const ghlId = await withCreds(creds, async () => {
      const contactId = sourceId || await ensureGhlContact({
        name: name || 'Contact',
        email,
      });
      if (!contactId) return '';
      return pushOpportunity({
        name: name || 'Contact',
        contactId,
        stage,
      });
    });
    return NextResponse.json({ ok: !!ghlId, opportunityId: ghlId || '' });
  } catch (err) {
    fail('pipeline_write', err);
    return NextResponse.json({ ok: false, note: 'GoHighLevel did not take that stage' });
  }
}
