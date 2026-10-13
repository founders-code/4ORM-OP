import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';
import { saveEmail, spaceIdOk } from '@/lib/spaces';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!session.sql || !spaceIdOk(params.id)) return NextResponse.json({ saved: false });
    const saved = await saveEmail(session.sql, session.userId, params.id, String(body.subject || body.emailSubject || ''), String(body.body || body.emailBody || ''));
    if (!saved) return NextResponse.json({ saved: false });
    return NextResponse.json(saved);
  } catch (err) {
    fail('spaces_email', err);
    return NextResponse.json({ saved: false });
  }
}
