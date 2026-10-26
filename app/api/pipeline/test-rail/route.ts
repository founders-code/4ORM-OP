import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { testOpportunityRail } from '@/lib/ghl';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const step = body.step === 'move' || body.step === 'archive' ? body.step : 'ensure';
    const creds = await loadCredsFor(session.userId);
    const out = await withCreds(creds, () => testOpportunityRail(step, {
      opportunityId: String(body.opportunityId || ''),
      stageId: String(body.stageId || ''),
      pipelineId: String(body.pipelineId || ''),
    }));
    return NextResponse.json(out, out.ok ? undefined : { status: 409 });
  } catch (err) {
    fail('pipeline_test_rail', err);
    return NextResponse.json({ ok: false, note: 'GoHighLevel did not take that TEST card.' }, { status: 500 });
  }
}
