import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { getSql } from '@/lib/db';
import { ghlOk } from '@/lib/hook-auth.mjs';
import { applyGhlEvent, runIntel } from '@/lib/live';
import { fail, note } from '@/lib/log';
import { ghlHookSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function denied() {
  note('hook_ghl', 'unsigned');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!ghlOk(req, raw, ghlHookSecret())) return denied();
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true, skipped: true });
    const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    const creds = await loadCredsFor(ownerId);
    const result = await withCreds(creds, () => applyGhlEvent(sql, ownerId, body));
    if (result.stageChanged) await runIntel(sql, ownerId, `ghl stage opp=${result.oppId}`);
    note('hook_ghl', `ok type=${String(body.type || body.event || '')} stage=${result.stageChanged ? '1' : '0'} contact=${result.contactId || '-'} opp=${result.oppId || '-'}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    fail('hook_ghl', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
