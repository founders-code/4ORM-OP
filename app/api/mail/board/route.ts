import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { boardMail } from '@/lib/google';
import { fail } from '@/lib/log';
import {
  classifyMail,
  ensureMailBoard,
  listColumns,
  listContactHits,
  listFiles,
  listRules,
  needsNow,
  readCache,
  tagsFor,
  writeCache,
} from '@/lib/mail-board';
import { openBoard } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.sql) return NextResponse.json({ messages: [], columns: [], rules: [], counts: { unread: 0, needs: 0, total: 0 } });
    await ensureMailBoard(session.sql);
    const url = new URL(req.url);
    const q = String(url.searchParams.get('q') || '').slice(0, 200);
    const refresh = url.searchParams.get('refresh') === '1';
    const columns = await listColumns(session.sql, session.userId);
    const rules = await listRules(session.sql, session.userId);
    const files = await listFiles(session.sql, session.userId);
    const contacts = await listContactHits(session.sql, session.userId);
    if (!refresh && !q) {
      const cached = await readCache(session.sql, session.userId);
      if (cached && !cached.stale && cached.payload && typeof cached.payload === 'object') {
        return NextResponse.json(cached.payload);
      }
    }
    const creds = await loadCredsFor(session.userId);
    const mail = await withCreds(creds, () => boardMail(q, 80)).catch((err) => {
      fail('mail_board', err);
      return null;
    });
    const raw = mail?.messages || [];
    const messages = raw.map((row) => {
      const column = classifyMail(row, rules, files, contacts);
      return {
        ...row,
        column,
        needsNow: needsNow(row, column),
        tags: tagsFor(row, column, contacts),
      };
    });
    const unread = messages.filter((row) => row.unread).length;
    const needs = messages.filter((row) => row.needsNow).length;
    const payload = {
      status: mail?.status || 'unavailable',
      messages,
      columns,
      rules,
      counts: { unread, needs, total: messages.length },
    };
    if (!q) await writeCache(session.sql, session.userId, payload);
    return NextResponse.json(payload);
  } catch (err) {
    fail('mail_board', err);
    return NextResponse.json({ messages: [], columns: [], rules: [], counts: { unread: 0, needs: 0, total: 0 } });
  }
}
