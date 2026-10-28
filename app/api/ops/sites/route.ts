import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { BEACON_KEY, dataRoomSessions, socialCards, visitCounts } from '@/lib/site-visits';

export const dynamic = 'force-dynamic';

const SITE_LABEL: Record<string, string> = { dataroom: 'DATA ROOM (4ORMDR)', '4ormfinance': '4ORMFINANCE.COM', '4ormiq': '4ORMIQ.COM', '4ormex': '4ORMEX.COM', '4ormop': '4ORMOP.COM' };

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ cards: [], drLog: [] }, { status: 503 });
    const [sessions, counts, social] = await Promise.all([
      dataRoomSessions(session.sql, 14).catch(() => []),
      visitCounts(session.sql, 7).catch(() => []),
      socialCards().catch(() => []),
    ]);
    const week = sessions.filter((s) => s.start > Date.now() - 7 * 86400000);
    const people = new Set(week.map((s) => s.email || s.who)).size;
    const avg = week.length ? Math.round(week.reduce((a, s) => a + s.ms, 0) / week.length / 60000) : 0;
    const cards = [
      { label: 'DATA ROOM SIGN-INS, 7 DAYS', connected: true, value: String(week.length), note: `${people} ${people === 1 ? 'person' : 'people'} · avg stay ${avg} min${BEACON_KEY ? '' : ' · add SITE_BEACON_KEY to both projects to verify reports'}` },
      { label: 'LAST DATA ROOM SIGN-IN', connected: true, value: sessions[0] ? sessions[0].who : 'None yet', note: sessions[0] ? sessions[0].when : 'logged from today' },
      ...['dataroom', '4ormfinance', '4ormiq'].map((k) => {
        const c = counts.find((x) => x.site === k);
        return c
          ? { label: `${SITE_LABEL[k]} VISITS, 7 DAYS`, connected: true, value: `${c.views} views`, note: `${c.people} visitors` }
          : { label: `${SITE_LABEL[k]} VISITS, 7 DAYS`, connected: k === 'dataroom', value: '0 views', note: k === 'dataroom' ? 'counting from today' : 'beacon not on this site yet' };
      }),
      ...social,
    ];
    return NextResponse.json({ cards, drLog: sessions.slice(0, 25) });
  } catch (err) {
    fail('ops_sites', err);
    return NextResponse.json({ cards: [], drLog: [] }, { status: 500 });
  }
}
