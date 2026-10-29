import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { ensureVaultAudit } from '@/lib/vault-audit';

export const dynamic = 'force-dynamic';

/**
 * The vault's shape for the locked screen: counts per category, counts of health flags and a safe audit log.
 * Signed-in owner only, like every vault route. It never returns a document name, ID, owner, note or link:
 * only category names (the register's own section labels), status counts and timestamps.
 */
export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ total: null, flags: null, categories: [], audit: [], reason: 'no database url' });
    const sql = session.sql;
    const rows = (await sql`
      SELECT COALESCE(NULLIF(kind, ''), 'Other') AS kind, COALESCE(NULLIF(status, ''), 'No status') AS status, count(*)::int AS n,
        count(*) FILTER (WHERE verified_at IS NULL OR verified_at < now() - interval '90 days')::int AS stale
      FROM vault_docs WHERE owner_id = ${ownerId}
      GROUP BY 1, 2
    `.catch(() => [])) as Array<{ kind: string; status: string; n: number; stale: number }>;
    const byKind = new Map<string, { kind: string; n: number; statuses: Record<string, number> }>();
    let total = 0;
    let drafts = 0;
    let due = 0;
    let stale = 0;
    for (const r of rows) {
      const k = byKind.get(r.kind) || { kind: r.kind, n: 0, statuses: {} };
      k.n += r.n;
      k.statuses[r.status] = (k.statuses[r.status] || 0) + r.n;
      byKind.set(r.kind, k);
      total += r.n;
      if (/^draft$/i.test(r.status)) drafts += r.n;
      if (/due|rebuild|scheduled/i.test(r.status)) due += r.n;
      stale += r.stale;
    }
    await ensureVaultAudit(sql).catch(() => null);
    const events = (await sql`
      SELECT at, what FROM vault_audit WHERE owner_id = ${ownerId} ORDER BY at DESC LIMIT 6
    `.catch(() => [])) as Array<{ at: string; what: string }>;
    const uploads = (await sql`
      SELECT v.uploaded_at AS at, COALESCE(NULLIF(d.kind, ''), 'the register') AS kind
      FROM vault_versions v JOIN vault_docs d ON d.id = v.doc_id
      WHERE d.owner_id = ${ownerId} ORDER BY v.uploaded_at DESC LIMIT 6
    `.catch(() => [])) as Array<{ at: string; kind: string }>;
    const audit = [
      ...events.map((e) => ({ at: new Date(String(e.at)).toISOString(), what: String(e.what || '').slice(0, 120) })),
      ...uploads.map((u) => ({ at: new Date(String(u.at)).toISOString(), what: `New version uploaded in ${String(u.kind).slice(0, 60)}` })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);
    return NextResponse.json({
      total,
      flags: { drafts, due, stale },
      categories: [...byKind.values()].sort((a, b) => b.n - a.n),
      audit,
    });
  } catch (err) {
    fail('vault_summary', err);
    return NextResponse.json({ total: null, flags: null, categories: [], audit: [], reason: 'vault unavailable' }, { status: 500 });
  }
}
