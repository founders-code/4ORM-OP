import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import {
  addTouch, callsToday, finishUpload, replanDays, growthRecord, setGrowthGhl, importGrowth, growthSummary, listGrowth, outreachLog, patchGrowth, planDays, saveUploadPart, undoTouch, vanToday,
} from '@/lib/growth';
import { openBoard, sessionEmail, sessionOwner, type BoardSession } from '@/lib/session';
import { createOpportunityAt, ensureGhlContact, ghlPlaceFor, moveOpportunityStage } from '@/lib/ghl';
import { withCreds } from '@/lib/creds';
import { loadCredsFor } from '@/lib/vault';
import { sendStagePackage } from '@/lib/stage-packages';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { err: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId, userId: session.userId, session };
}

/* The opstest account may only write to GoHighLevel for TEST rows, never real contacts. */
async function ghlWriteAllowed(g: { session: BoardSession }, rec: Record<string, unknown>) {
  const email = await sessionEmail(g.session).catch(() => '');
  if (!/opstest@4ormfinance\.com/i.test(String(email || ''))) return true;
  return /TEST/.test(String(rec.name || '')) || /opstest/i.test(String(rec.email || ''));
}

/** Look the record up in GoHighLevel and remember its contact, pipeline and stage on the record. */
async function ghlPlace(g: { sql: NonNullable<BoardSession['sql']>; ownerId: string; userId: string }, rec: Record<string, unknown>) {
  const creds = await loadCredsFor(g.userId);
  const known = ((rec.data as Record<string, unknown>)?.ghl || {}) as Record<string, unknown>;
  const place = await withCreds(creds, () => ghlPlaceFor(String(rec.email || ''), String(known.contactId || '')));
  if (place.connected) {
    const top = place.opps[0];
    await setGrowthGhl(g.sql, g.ownerId, String(rec.id), {
      contactId: place.contactId, opportunityId: top?.id || '', pipeline: top?.pipeline || '', stage: top?.stage || '', checked: new Date().toISOString(),
    });
  }
  return place;
}

export async function GET(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const u = new URL(req.url);
    if (u.searchParams.get('id')) {
      const r = await growthRecord(g.sql, g.ownerId, String(u.searchParams.get('id')));
      return r ? NextResponse.json(r) : NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (u.searchParams.get('ghl')) {
      const rec = await growthRecord(g.sql, g.ownerId, String(u.searchParams.get('ghl')));
      if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(await ghlPlace(g, rec as Record<string, unknown>));
    }
    if (u.searchParams.get('calls')) return NextResponse.json(await callsToday(g.sql, g.ownerId));
    if (u.searchParams.get('log')) return NextResponse.json({ log: await outreachLog(g.sql, g.ownerId, Number(u.searchParams.get('days')) || 60) });
    if (u.searchParams.get('summary')) return NextResponse.json(await growthSummary(g.sql, g.ownerId));
    const list = u.searchParams.get('list');
    return NextResponse.json({ today: vanToday(), records: await listGrowth(g.sql, g.ownerId, list) });
  } catch (err) {
    fail('growth_get', err);
    return NextResponse.json({ error: 'Could not load the lists' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === 'upload-part') {
      const id = String(body.upload || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
      const b64 = String(body.b64 || '');
      if (!id || !/^[A-Za-z0-9+/=]+$/.test(b64)) return NextResponse.json({ error: 'Bad part' }, { status: 400 });
      await saveUploadPart(g.sql, g.ownerId, id, Number(body.part) || 0, b64);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'import-json') {
      const recs = Array.isArray(body.records) ? (body.records as Array<Record<string, unknown>>) : [];
      if (!recs.length) return NextResponse.json({ error: 'No records' }, { status: 400 });
      return NextResponse.json({ ok: true, imported: await importGrowth(g.sql, g.ownerId, recs.slice(0, 2000)) });
    }
    if (body.action === 'upload-finish') {
      const id = String(body.upload || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
      return NextResponse.json({ ok: true, imported: await finishUpload(g.sql, g.ownerId, id) });
    }
    if (body.action === 'replan') {
      return NextResponse.json({ ok: true, planned: await replanDays(g.sql, g.ownerId) });
    }
    if (body.action === 'plan') {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.start || '')) ? String(body.start) : vanToday();
      return NextResponse.json({ ok: true, planned: await planDays(g.sql, g.ownerId, start) });
    }
    if (body.action === 'touch') {
      const t = await addTouch(g.sql, g.ownerId, String(body.id || ''), body as Record<string, string>);
      return NextResponse.json({ ok: true, touch: t, undo: true });
    }
    if (body.action === 'ghl-move') {
      /* Move this person to a GoHighLevel stage. With no opportunity yet, the contact is found or added, then one opportunity is opened at that stage. */
      const rec = (await growthRecord(g.sql, g.ownerId, String(body.id || ''))) as Record<string, unknown> | null;
      if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (!(await ghlWriteAllowed(g, rec))) return NextResponse.json({ error: 'Test account: GoHighLevel writes only for TEST rows' }, { status: 403 });
      const pipelineId = String(body.pipelineId || '').slice(0, 64);
      const stageId = String(body.stageId || '').slice(0, 64);
      const stageName = String(body.stageName || '').slice(0, 80);
      if (!pipelineId || !stageId) return NextResponse.json({ error: 'Pick a stage' }, { status: 400 });
      const creds = await loadCredsFor(g.userId);
      let oppId = String(body.opportunityId || '').slice(0, 64);
      let note = '';
      if (oppId) {
        const moved = await withCreds(creds, () => moveOpportunityStage({ opportunityId: oppId, pipelineId, stageId }));
        if (!moved.ok) return NextResponse.json({ error: moved.note }, { status: moved.status });
        note = 'Moved in GoHighLevel';
      } else {
        const known = ((rec.data as Record<string, unknown>)?.ghl || {}) as Record<string, unknown>;
        const isPerson = rec.list === 'angels';
        const person = String(rec.contact || '').split(/\s*[|;,]\s*/)[0] || '';
        const contactId = String(known.contactId || '') || await withCreds(creds, () => ensureGhlContact({
          name: isPerson ? String(rec.name || '') : (person && !/@|^\+?\d|contact|leadership|executive/i.test(person) ? person : String(rec.name || '')),
          company: isPerson ? '' : String(rec.name || ''),
          email: String(rec.email || ''),
        }));
        if (!contactId) return NextResponse.json({ error: 'GoHighLevel did not add this contact' }, { status: 502 });
        oppId = await withCreds(creds, () => createOpportunityAt({ contactId, name: String(rec.name || 'Contact'), pipelineId, stageId }));
        if (!oppId) return NextResponse.json({ error: 'GoHighLevel did not open the opportunity' }, { status: 502 });
        note = 'Added to GoHighLevel';
      }
      await addTouch(g.sql, g.ownerId, String(rec.id), { channel: 'GoHighLevel', outcome: '', note: `${note}: ${stageName || 'new stage'}`, status: String(rec.status || 'Contacted') });
      const place = await ghlPlace(g, rec);
      /* GoHighLevel's search lags a few seconds behind a move, so show the stage that was just set. */
      const pipe = place.pipelines.find((p) => p.id === pipelineId);
      const stage = pipe?.stages.find((x) => x.id === stageId);
      const hit = place.opps.find((o) => o.id === oppId);
      const fixed = { id: oppId, name: hit?.name || String(rec.name || ''), pipelineId, pipeline: pipe?.name || '', stageId, stage: stage?.name || stageName, status: hit?.status || 'open' };
      place.opps = [fixed, ...place.opps.filter((o) => o.id !== oppId)];
      await setGrowthGhl(g.sql, g.ownerId, String(rec.id), { contactId: place.contactId, opportunityId: oppId, pipeline: fixed.pipeline, stage: fixed.stage, checked: new Date().toISOString() });
      /* Chad confirmed the stage package on screen; only then does it go out. */
      let sent: Record<string, unknown> | null = null;
      if (body.send === true) {
        const out = await withCreds(creds, () => sendStagePackage(g.sql, g.ownerId, rec, stageId, { contactId: place.contactId, spaceOwner: g.userId }));
        sent = out;
        if (out.ok) {
          const days = Number((out as { followDays?: number }).followDays) || 0;
          const next = days ? new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }) : '';
          await addTouch(g.sql, g.ownerId, String(rec.id), { channel: 'Email', outcome: 'Sent', note: `Stage package sent (${fixed.stage}): ${String((out as { subject?: string }).subject || '')}`, next_date: next, status: String(rec.status || 'Contacted') });
        }
      }
      return NextResponse.json({ ok: true, opportunityId: oppId, place, sent });
    }
    if (body.action === 'undo-touch') {
      await undoTouch(g.sql, g.ownerId, Number(body.touchId) || 0);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    fail('growth_post', err);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const g = await gate();
  if ('err' in g) return g.err;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const row = await patchGrowth(g.sql, g.ownerId, String(body.id || ''), body);
    return row ? NextResponse.json({ ok: true, record: row }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    fail('growth_patch', err);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
