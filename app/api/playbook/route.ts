import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { addRhythm, listPlaybook, logPlay, patchRhythm } from '@/lib/playbook';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ rows: [], days: [], todayLit: 0, score: 0 });
    const week = new URL(req.url).searchParams.get('week') || '';
    const desk = await listPlaybook(session.sql, session.userId, week);
    return NextResponse.json(desk);
  } catch (err) {
    fail('playbook_failed', err);
    return NextResponse.json({ rows: [], days: [], todayLit: 0, score: 0, error: 'Playbook could not be read.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'Playbook could not be updated.' }, { status: 400 });
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (String(body?.action || '') === 'edit') {
      const rhythmId = String(body?.rhythmId || '');
      const desk = await patchRhythm(session.sql, session.userId, rhythmId, {
        name: body?.name != null ? String(body.name) : undefined,
        schedule: Array.isArray(body?.schedule) ? body.schedule.map((x) => String(x)) : undefined,
        active: body?.active === false ? false : body?.active === true ? true : undefined,
        grp: body?.grp != null ? String(body.grp) : undefined,
      });
      return NextResponse.json(desk);
    }
    if (body?.name) {
      const desk = await addRhythm(session.sql, session.userId, {
        name: String(body.name),
        color: String(body.color || ''),
        route: String(body.route || ''),
        schedule: Array.isArray(body.schedule) ? body.schedule.map((x) => String(x)) : undefined,
        target: String(body.target || ''),
      });
      return NextResponse.json(desk);
    }
    const rhythmId = String(body?.rhythmId || '');
    const day = String(body?.day || '');
    const status = String(body?.status || 'done');
    if (!ID.test(rhythmId) || !DAY.test(day)) {
      return NextResponse.json({ error: 'Playbook could not be updated.' }, { status: 400 });
    }
    const desk = await logPlay(session.sql, session.userId, rhythmId, day, status, String(body?.value || ''));
    return NextResponse.json(desk);
  } catch (err) {
    fail('playbook_failed', err);
    return NextResponse.json({ error: 'Playbook could not be updated.' }, { status: 500 });
  }
}
