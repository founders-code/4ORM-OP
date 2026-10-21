import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { getSql } from '@/lib/db';
import { calendarTokenOk, hookTokenOk } from '@/lib/hook-auth.mjs';
import { applyCalendarNotify } from '@/lib/live';
import { fail, note } from '@/lib/log';
import { calendarHookToken } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function denied() {
  note('hook_calendar', 'unsigned');
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: Request) {
  const expected = calendarHookToken();
  if (!calendarTokenOk(req.headers, expected) && !hookTokenOk(req, expected)) return denied();
  const state = (req.headers.get('x-goog-resource-state') || '').toLowerCase();
  if (state === 'sync') {
    note('hook_calendar', 'sync');
    return NextResponse.json({ ok: true });
  }
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: false }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true, skipped: true });
    const creds = await loadCredsFor(ownerId);
    await withCreds(creds, () => applyCalendarNotify(sql, ownerId));
    note('hook_calendar', `ok state=${state || 'exists'}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    fail('hook_calendar', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
