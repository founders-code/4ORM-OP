import { NextResponse } from 'next/server';
import { markSource } from '@/lib/integrations-records';
import { fail } from '@/lib/log';
import { perplexityConfigured, research } from '@/lib/perplexity';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ configured: perplexityConfigured() });
  } catch (err) {
    fail('perplexity_status', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 });
  }
}

/**
 * Research with sources. Body: { q: string, context?: string, kind?: 'news' | 'space' | 'check' }.
 * Returns { answer, sources: [{ n, title, url, date }] }; [n] markers in the answer match sources[].n.
 * kind 'check' runs a one-line test question for the Integrations row.
 */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!perplexityConfigured()) return NextResponse.json({ error: 'Perplexity is not connected. Set PERPLEXITY_API_KEY in Vercel.' }, { status: 503 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const kind = String(body?.kind || 'news');
    const q = kind === 'check' ? 'What is the Retail Payment Activities Act in Canada? One sentence.' : String(body?.q || '');
    if (!q.trim()) return NextResponse.json({ error: 'Nothing to research.' }, { status: 400 });
    if (session.sql && !(await takeRateLimit(session.sql, 'perplexity', ownerId, 30, 3600).catch(() => true))) {
      return NextResponse.json({ error: 'That is 30 research calls this hour. Try again later.' }, { status: 429 });
    }
    const out = await research(q, String(body?.context || ''));
    if (session.sql) {
      await markSource(session.sql, ownerId, 'perplexity', out.ok ? 'connected' : 'unavailable', out.ok ? `last answer had ${out.sources.length} sources` : out.error);
    }
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json({ ok: true, answer: out.answer, sources: out.sources });
  } catch (err) {
    fail('perplexity_research', err);
    return NextResponse.json({ error: 'Research failed.' }, { status: 500 });
  }
}
