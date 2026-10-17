import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { ensureMailBoard, listRules, saveRule } from '@/lib/mail-board';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ rules: [] });
    await ensureMailBoard(session.sql);
    return NextResponse.json({ rules: await listRules(session.sql, session.userId) });
  } catch (err) {
    fail('mail_rules', err);
    return NextResponse.json({ rules: [] });
  }
}

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ saved: false });
    await ensureMailBoard(session.sql);
    const drop = String(body.delete || body.id || '');
    if (body.delete && /^[0-9a-f-]{36}$/i.test(drop)) {
      try {
        await session.sql`DELETE FROM email_rules WHERE id = ${drop} AND owner_id = ${session.userId}`;
      } catch (err) {
        fail('mail_rule_del', err);
        return NextResponse.json({ saved: false });
      }
      return NextResponse.json({ saved: true, rules: await listRules(session.sql, session.userId) });
    }
    const rule = await saveRule(session.sql, session.userId, {
      matchType: String(body.matchType || body.match_type || ''),
      matchValue: String(body.matchValue || body.match_value || ''),
      target: String(body.target || body.target_column || ''),
      sticky: body.sticky !== false,
    });
    return NextResponse.json({ saved: !!rule, rule, rules: await listRules(session.sql, session.userId) });
  } catch (err) {
    fail('mail_rules_write', err);
    return NextResponse.json({ saved: false });
  }
}
