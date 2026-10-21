import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { getSql } from '@/lib/db';
import { hookTokenOk } from '@/lib/hook-auth.mjs';
import { applyGmailHistory, runIntel } from '@/lib/live';
import { fail, note } from '@/lib/log';
import { gmailHookToken } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function denied() {
  note('hook_gmail', 'unsigned');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  if (!hookTokenOk(req, gmailHookToken())) return denied();
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true, skipped: true });
    const body = (await req.json().catch(() => null)) as { message?: { data?: string } } | null;
    if (body?.message?.data) {
      try {
        JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8'));
      } catch {
        /* Pub/Sub envelope is enough to proceed */
      }
    }
    const creds = await loadCredsFor(ownerId);
    const result = await withCreds(creds, () => applyGmailHistory(sql, ownerId));
    if ((result.added || result.linkedin) && result.titles?.length) {
      await runIntel(sql, ownerId, `gmail added=${result.added}`);
    } else if (result.added || result.linkedin) {
      await runIntel(sql, ownerId, `gmail added=${result.added} linkedin=${result.linkedin}`);
    }
    note('hook_gmail', `ok mode=${result.mode} added=${result.added} linkedin=${result.linkedin}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    fail('hook_gmail', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
