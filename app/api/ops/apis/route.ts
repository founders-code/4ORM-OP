import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { outbound, recordCall, tape } from '@/lib/outbound';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const APIS = [
  { key: 'ghl', name: 'GoHighLevel', endpoint: 'https://services.leadconnectorhq.com' },
  { key: 'google', name: 'Google Workspace', endpoint: 'https://www.googleapis.com' },
  { key: 'zoom', name: 'Zoom', endpoint: 'https://api.zoom.us' },
  { key: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com' },
  { key: 'anthropic', name: 'Anthropic', endpoint: 'https://api.anthropic.com' },
  { key: 'neon', name: 'Neon Postgres', endpoint: 'postgres' },
  { key: 'clerk', name: 'Clerk', endpoint: 'https://api.clerk.com' },
  { key: 'boc', name: 'Bank of Canada', endpoint: 'https://www.bankofcanada.ca/valet' },
  { key: 'iq', name: '4ormIQ control room', endpoint: 'https://4ormiq.com/api/control-room' },
  { key: 'vercel', name: 'Vercel', endpoint: 'https://api.vercel.com' },
];

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const url = new URL(req.url);
    const key = String(url.searchParams.get('key') || '');
    const logs = url.searchParams.get('logs') === '1';
    if (logs) {
      if (!key) return NextResponse.json({ calls: [], reason: 'no api key' }, { status: 400 });
      if (!session.sql) return NextResponse.json({ calls: [], reason: 'no database url' });
      const calls = await session.sql`
        SELECT api, path, code, ms, at FROM api_calls
        WHERE api = ${key}
        ORDER BY at DESC LIMIT 40
      `;
      return NextResponse.json({
        calls: calls || [],
        reason: !calls || !calls.length ? 'no calls logged for this service yet' : '',
      });
    }
    type Agg = { ms: number | null; callsToday: number; errors24h: number };
    const agg = new Map<string, Agg>();
    if (session.sql) {
      try {
        const last = await session.sql`
          SELECT DISTINCT ON (api) api, ms FROM api_calls ORDER BY api, at DESC
        `;
        const today = await session.sql`
          SELECT api, count(*)::int AS n FROM api_calls
          WHERE at >= (timezone('America/Vancouver', now()))::date
          GROUP BY api
        `;
        const errs = await session.sql`
          SELECT api, count(*)::int AS n FROM api_calls
          WHERE at > now() - interval '24 hours' AND (code = 0 OR code >= 400)
          GROUP BY api
        `;
        for (const a of APIS) agg.set(a.key, { ms: null, callsToday: 0, errors24h: 0 });
        for (const r of last || []) {
          const cur = agg.get(String(r.api)) || { ms: null, callsToday: 0, errors24h: 0 };
          cur.ms = r.ms == null ? null : Number(r.ms);
          agg.set(String(r.api), cur);
        }
        for (const r of today || []) {
          const cur = agg.get(String(r.api)) || { ms: null, callsToday: 0, errors24h: 0 };
          cur.callsToday = Number(r.n) || 0;
          agg.set(String(r.api), cur);
        }
        for (const r of errs || []) {
          const cur = agg.get(String(r.api)) || { ms: null, callsToday: 0, errors24h: 0 };
          cur.errors24h = Number(r.n) || 0;
          agg.set(String(r.api), cur);
        }
      } catch {
        /* no samples */
      }
    }
    const spark = new Map<string, number[]>();
    if (session.sql) {
      try {
        const hist = await session.sql`
          SELECT api, ms FROM api_calls WHERE ms IS NOT NULL ORDER BY at DESC LIMIT 800
        `;
        for (const r of hist || []) {
          const k = String(r.api || '');
          const ms = r.ms == null ? null : Number(r.ms);
          if (!k || ms == null || !Number.isFinite(ms)) continue;
          const list = spark.get(k) || [];
          if (list.length >= 40) continue;
          list.push(ms);
          spark.set(k, list);
        }
        for (const [k, list] of spark) spark.set(k, list.slice().reverse());
      } catch {
        /* no history */
      }
    }
    return NextResponse.json({
      apis: APIS.map((a) => {
        const s = agg.get(a.key) || { ms: null, callsToday: 0, errors24h: 0 };
        return {
          ...a,
          status: a.key === 'openai' && !process.env.OPENAI_API_KEY ? 'DOWN' : 'LIVE',
          ms: s.ms,
          spark: spark.get(a.key) || [],
          callsToday: s.callsToday,
          errors24h: s.errors24h,
          keyValid: a.key === 'openai' ? !!process.env.OPENAI_API_KEY : true,
          reason: s.ms == null ? 'no sample yet' : '',
        };
      }),
    });
  } catch (err) {
    fail('ops_apis', err);
    return NextResponse.json({ apis: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => null);
    const key = String(body?.key || '');
    const act = String(body?.act || 'ping');
    const hit = APIS.find((a) => a.key === key);
    if (!hit) return NextResponse.json({ ok: false }, { status: 400 });
    if (act === 'pause') {
      if (session.sql) {
        await session.sql`INSERT INTO ops_switches (key, on_state, changed_by) VALUES (${'api_' + key}, false, ${session.userId})
          ON CONFLICT (key) DO UPDATE SET on_state = false, changed_at = now()`;
      }
      await tape('warn', key, hit.name + ' paused');
      return NextResponse.json({ ok: true, paused: true });
    }
    const t0 = Date.now();
    let code = 0;
    try {
      if (hit.key === 'neon' && session.sql) {
        await session.sql`SELECT 1`;
        code = 200;
        await recordCall('neon', 'SELECT 1', 200, Date.now() - t0);
      } else if (hit.endpoint.startsWith('http')) {
        const r = await outbound(hit.endpoint, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(8000) }).catch(() => null);
        code = r ? r.status : 0;
      }
    } catch {
      code = 0;
    }
    const ms = Date.now() - t0;
    await tape(code && code < 400 ? 'ok' : 'err', key, hit.name + (code ? ' answered in ' + ms + ' ms' : ' no answer in ' + ms + ' ms'));
    return NextResponse.json({ ok: true, ms, code });
  } catch (err) {
    fail('ops_apis_post', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
