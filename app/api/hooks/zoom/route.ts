import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { zoomCrc, zoomOk } from '@/lib/hook-auth.mjs';
import { applyZoomEvent, runIntel } from '@/lib/live';
import { fail, note } from '@/lib/log';
import { zoomHookSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function denied() {
  note('hook_zoom', 'unsigned');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = zoomHookSecret();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (String(body.event || '') === 'endpoint.url_validation') {
    const plainToken = String((body.payload as { plainToken?: string } | undefined)?.plainToken || '');
    if (!secret || !plainToken) return denied();
    note('hook_zoom', 'crc');
    return NextResponse.json({ plainToken, encryptedToken: zoomCrc(plainToken, secret) });
  }
  const timestamp = req.headers.get('x-zm-request-timestamp') || '';
  const presented = req.headers.get('x-zm-signature') || '';
  if (!zoomOk(raw, timestamp, presented, secret)) return denied();
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true, skipped: true });
    const result = await applyZoomEvent(sql, ownerId, body);
    if (result.added) await runIntel(sql, ownerId, `zoom ${String(body.event || '')}`);
    note('hook_zoom', `ok event=${String(body.event || '')} added=${result.added ? '1' : '0'}`);
    return NextResponse.json({ ok: true, added: result.added });
  } catch (err) {
    fail('hook_zoom', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
