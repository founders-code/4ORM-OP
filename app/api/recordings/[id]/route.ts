import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import {
  assembleChunks,
  getRecording,
  getRecordingAudio,
  patchRecording,
  processRecording,
  saveAudio,
  saveChunk,
  softDeleteRecording,
} from '@/lib/recordings';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const id = String(ctx.params.id || '');
    if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const url = new URL(req.url);
    if (url.searchParams.get('audio') === '1') {
      const b64 = await getRecordingAudio(session.sql, session.userId, id);
      if (!b64) return NextResponse.json({ error: 'No audio' }, { status: 404 });
      return new NextResponse(Buffer.from(b64, 'base64'), { headers: { 'content-type': 'audio/webm' } });
    }
    const rec = await getRecording(session.sql, session.userId, id);
    if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rec);
  } catch (err) {
    fail('recording_get', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const id = String(ctx.params.id || '');
    if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === 'chunk') {
      await saveChunk(session.sql, session.userId, id, Number(body.n) || 0, String(body.b64 || ''));
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'reprocess') {
      const rec = await processRecording(session.sql, session.userId, id);
      return NextResponse.json(rec || { ok: false }, rec ? undefined : { status: 404 });
    }
    if (body.action === 'finalize') {
      if (body.b64) await saveAudio(session.sql, session.userId, id, String(body.b64));
      else await assembleChunks(session.sql, session.userId, id);
      const rec = await processRecording(session.sql, session.userId, id);
      return NextResponse.json(rec || { ok: false }, rec ? undefined : { status: 404 });
    }
    const rec = await patchRecording(session.sql, session.userId, id, body);
    if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rec);
  } catch (err) {
    fail('recording_patch', err);
    return NextResponse.json({ error: 'Could not update.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const id = String(ctx.params.id || '');
    if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await softDeleteRecording(session.sql, session.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('recording_delete', err);
    return NextResponse.json({ error: 'Could not remove.' }, { status: 500 });
  }
}
