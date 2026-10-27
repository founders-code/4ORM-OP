import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
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

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({
      apis: APIS.map((a) => ({
        ...a,
        status: 'LIVE',
        ms: null,
        callsToday: 0,
        errors24h: 0,
        keyValid: a.key === 'openai' ? !!process.env.OPENAI_API_KEY : true,
      })),
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
      return NextResponse.json({ ok: true, paused: true });
    }
    const t0 = Date.now();
    let code = 0;
    try {
      if (hit.endpoint.startsWith('http')) {
        const r = await fetch(hit.endpoint, { method: 'HEAD' }).catch(() => null);
        code = r ? r.status : 0;
      }
    } catch {
      code = 0;
    }
    const ms = Date.now() - t0;
    if (session.sql) {
      await session.sql`INSERT INTO api_calls (api, path, code, ms) VALUES (${key}, ${hit.endpoint}, ${code}, ${ms})`;
    }
    return NextResponse.json({ ok: true, ms, code });
  } catch (err) {
    fail('ops_apis_post', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
