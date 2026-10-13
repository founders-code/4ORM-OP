import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { listPlans, savePlan } from '@/lib/war';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ plans: [] });
    return NextResponse.json({ plans: await listPlans(session.sql, session.userId) });
  } catch (err) {
    fail('plans_failed', err);
    return NextResponse.json({ plans: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ itemId: '', steps: [], needs: [], draft: '', created: [] });
    const body = await req.json().catch(() => null);
    const saved = await savePlan(session.sql, session.userId, {
      itemId: String(body?.itemId || ''),
      steps: body?.steps,
      needs: body?.needs,
      draft: String(body?.draft || ''),
      push: body?.push === true,
      title: String(body?.title || ''),
      area: String(body?.area || 'other'),
      due: body?.due ?? null,
    });
    if (!saved) return NextResponse.json({ error: 'Unavailable' }, { status: 400 });
    return NextResponse.json(saved);
  } catch (err) {
    fail('plans_failed', err);
    return NextResponse.json({ itemId: '', steps: [], needs: [], draft: '', created: [] });
  }
}
