import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { tokenOk } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { BEACON_KEY, recordVisit, tooMany } from '@/lib/site-visits';

export const dynamic = 'force-dynamic';

/* Page views from our own sites (data room middleware, site beacons). Shared key, fails closed. */
const SITES = new Set(['dataroom', '4ormfinance', '4ormiq', '4ormop', '4ormex']);

function cors(res: NextResponse) {
  res.headers.set('access-control-allow-origin', '*');
  res.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  res.headers.set('access-control-allow-headers', 'content-type, x-beacon-key');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const key = String(req.headers.get('x-beacon-key') || '');
    const verified = !!BEACON_KEY && tokenOk(key, BEACON_KEY);
    if (BEACON_KEY && !verified) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const ip = String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const site = String(body?.site || '');
    if (!SITES.has(site)) return cors(NextResponse.json({ error: 'Unknown site' }, { status: 400 }));
    const sql = await getSql();
    if (!sql) return cors(NextResponse.json({ error: 'Unavailable' }, { status: 503 }));
    if (await tooMany(sql, ip)) return cors(NextResponse.json({ error: 'Slow down' }, { status: 429 }));
    const r = await recordVisit(sql, {
      site,
      path: String(body?.path || '/'),
      userId: body?.userId ? String(body.userId) : undefined,
      email: body?.email ? String(body.email) : undefined,
      name: body?.name ? String(body.name) : undefined,
      visitor: body?.visitor ? String(body.visitor) : undefined,
      ref: body?.ref ? String(body.ref) : undefined,
      verified,
      ip,
    });
    return cors(NextResponse.json({ ok: true, fresh: r.fresh }));
  } catch (err) {
    fail('visit_hook', err);
    return cors(NextResponse.json({ error: 'Failed' }, { status: 500 }));
  }
}
