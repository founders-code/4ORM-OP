import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import {
  addTouch, finishUpload, growthRecord, importGrowth, growthSummary, listGrowth, outreachLog, patchGrowth, planDays, saveUploadPart, undoTouch, vanToday,
} from '@/lib/growth';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function gate() {
  const session = await openBoard();
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!session.sql) return { err: NextResponse.json({ error: 'No database' }, { status: 503 }) };
  return { sql: session.sql, ownerId };
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
    if (body.action === 'plan') {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.start || '')) ? String(body.start) : vanToday();
      return NextResponse.json({ ok: true, planned: await planDays(g.sql, g.ownerId, start) });
    }
    if (body.action === 'touch') {
      const t = await addTouch(g.sql, g.ownerId, String(body.id || ''), body as Record<string, string>);
      return NextResponse.json({ ok: true, touch: t, undo: true });
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
