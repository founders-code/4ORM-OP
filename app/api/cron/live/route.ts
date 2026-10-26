import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { publicOrigin, safetySweep } from '@/lib/live';
import { pollRecordSources } from '@/lib/granola';
import { fail, note } from '@/lib/log';
import { sendDueMail } from '@/lib/schedule';
import { cronSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, cronSecret())) {
    note('cron_live', 'unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) {
      note('cron_live', 'no owner');
      return NextResponse.json({ ok: true, skipped: true });
    }
    // Scheduled sends first (B34): only rows Chad queued, each claimed atomically so nothing sends twice.
    const scheduled = await sendDueMail(sql, ownerId);
    const creds = await loadCredsFor(ownerId);
    const origin = publicOrigin();
    const result = await withCreds(creds, () => safetySweep(sql, ownerId, origin));
    // Granola and Riverside have no push for this account, so they are polled here at most every 30 minutes.
    const records = await pollRecordSources(sql, ownerId);
    return NextResponse.json({ ok: true, ...result, scheduled: { sent: scheduled.sent, failed: scheduled.failed }, records });
  } catch (err) {
    fail('cron_live', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
