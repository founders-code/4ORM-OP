import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { withCreds } from '@/lib/creds';
import { isBriefHour, tokenOk, windowKey } from '@/lib/guard.mjs';
import { fail } from '@/lib/log';
import { cronSecret, ingestToken } from '@/lib/secrets';
import { roomOwner } from '@/lib/session';
import { refreshCeo } from '@/lib/ceo';
import { sweepNews } from '@/lib/news-sweep';
import { ingestMail, syncCalendar, syncGhl, writeBrief } from '@/lib/sync';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const header = req.headers.get('authorization') || '';
  const presented = header.slice(0, 7).toLowerCase() === 'bearer ' ? header.slice(7).trim() : '';
  if (!tokenOk(presented, cronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isBriefHour()) return NextResponse.json({ ok: true });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ ok: true });
    const claimed = await sql`
      INSERT INTO ingest_guard (owner_id, window_key)
      VALUES (${ownerId}, ${`brief-${windowKey()}`})
      ON CONFLICT DO NOTHING
      RETURNING owner_id
    `;
    if (!claimed.length) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const creds = await loadCredsFor(ownerId);
    const mail = await withCreds(creds, async () => {
      const pulled = await ingestMail(sql, ownerId, true);
      await syncCalendar(sql, ownerId, true);
      await syncGhl(sql, ownerId, true);
      return pulled;
    });
    const token = ingestToken();
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
    if (host && token && mail.items.length) {
      await fetch(`https://${host}/api/ingest`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ingest-token': token,
        },
        body: JSON.stringify({ items: mail.items }),
      });
    }
    const open = await sql`
      SELECT title, due
      FROM items
      WHERE owner_id = ${ownerId}
        AND status NOT IN ('done', 'dropped')
        AND due IS NOT NULL
      ORDER BY due
      LIMIT 40
    `;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Edmonton',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const lines = (open as Array<{ title?: string; due?: string }>).flatMap((row) => {
      const due = row.due ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(String(row.due))) : '';
      if (!due || !row.title) return [];
      if (due < today) return [`Overdue - ${String(row.title)}`];
      if (due === today) return [`Due today - ${String(row.title)}`];
      return [];
    });
    await writeBrief(sql, ownerId, lines, ['items']);
    try {
      await refreshCeo(sql, ownerId);
    } catch {
      fail('ceo_failed');
    }
    try {
      await sweepNews(sql, ownerId);
    } catch {
      fail('news_sweep');
    }
    return NextResponse.json({ ok: true });
  } catch {
    fail('brief_failed');
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
