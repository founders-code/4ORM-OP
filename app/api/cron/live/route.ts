import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { publicOrigin, safetySweep } from '@/lib/live';
import { fail, note } from '@/lib/log';
import { sampleOpsDials } from '@/lib/ops-sample';
import { tape } from '@/lib/outbound';
import { sendDueMail } from '@/lib/schedule';
import { bwProcess } from '@/lib/bw';
import { cronSecret } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';
import { seedVaultDocs } from '@/lib/vault-seed';

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
    /* Bruce's group email: the next batch through GoHighLevel (claimed atomically, never twice). */
    const bw = await withCreds(creds, () => bwProcess(sql, ownerId, Date.now() + 25000)).catch((err) => { fail('cron_bw', err); return { sent: 0, failed: 0, claimed: 0 }; });
    const origin = publicOrigin();
    const result = await withCreds(creds, () => safetySweep(sql, ownerId, origin));
    /* The Vault register only changes when a document is filed, so it is re-seeded once a day, not every 5 minutes. */
    const seededAt = await sql`SELECT synced_at FROM sync_state WHERE owner_id = ${ownerId} AND source = 'vault_seed'`.then((r) => (r[0]?.synced_at ? new Date(String(r[0].synced_at)).getTime() : 0)).catch(() => 0);
    let vault = { added: 0, total: 0 };
    if (Date.now() - seededAt > 24 * 3600 * 1000) {
      vault = await seedVaultDocs(sql, ownerId);
      await sql`INSERT INTO sync_state (owner_id, source, status, detail, synced_at) VALUES (${ownerId}, 'vault_seed', 'connected', ${`${vault.total} register rows`}, now())
        ON CONFLICT (owner_id, source) DO UPDATE SET status = EXCLUDED.status, detail = EXCLUDED.detail, synced_at = now()`.catch(() => null);
    }
    const dials = await sampleOpsDials(sql);
    await tape('ok', 'cron', `sweep mail=${result.mail || 0} zoom=${result.zoom || 0} vault+${vault.added}`);
    return NextResponse.json({
      ok: true,
      ...result,
      scheduled: { sent: scheduled.sent, failed: scheduled.failed },
      bw,
      vault,
      dials,
    });
  } catch (err) {
    fail('cron_live', err);
    await tape('err', 'cron', 'live sweep failed');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
