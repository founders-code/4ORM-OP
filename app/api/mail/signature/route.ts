import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { cleanMailHtml, gmailSignature } from '@/lib/google';
import { fail } from '@/lib/log';
import { ensureMailBoard } from '@/lib/mail-board';
import { openBoard, sessionOwner, type BoardSession } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';

const FROM = 'chad@4ormfinance.com';
const CACHE_MS = 6 * 60 * 60 * 1000;

async function readRow(sql: BoardSession['sql'], ownerId: string) {
  if (!sql) return null;
  try {
    const rows = await sql`SELECT mail_signature, mail_signature_gmail, mail_signature_at FROM owner_settings WHERE owner_id = ${ownerId} LIMIT 1`;
    return (rows[0] as { mail_signature?: string | null; mail_signature_gmail?: string | null; mail_signature_at?: string | null } | undefined) || null;
  } catch (err) {
    fail('mail_signature_read', err);
    return null;
  }
}

/** GET: the compose signature. Gmail sendAs signature first (cached 6 h; ?refresh=1 skips the cache), else the pasted one. */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ signature: '', source: 'none', needsScope: false });
    await ensureMailBoard(session.sql);
    const refresh = new URL(req.url).searchParams.get('refresh') === '1';
    const row = await readRow(session.sql, session.userId);
    const saved = String(row?.mail_signature || '');
    const cachedAt = row?.mail_signature_at ? new Date(String(row.mail_signature_at)).getTime() : 0;
    if (!refresh && row?.mail_signature_gmail && cachedAt && Date.now() - cachedAt < CACHE_MS) {
      return NextResponse.json({ signature: String(row.mail_signature_gmail), source: 'gmail', needsScope: false, saved });
    }
    const creds = await loadCredsFor(session.userId);
    const got = await withCreds(creds, () => gmailSignature(FROM)).catch(() => null);
    if (got && got.ok) {
      try {
        await session.sql`
          INSERT INTO owner_settings (owner_id, mail_signature_gmail, mail_signature_at)
          VALUES (${session.userId}, ${got.signature}, now())
          ON CONFLICT (owner_id) DO UPDATE SET mail_signature_gmail = EXCLUDED.mail_signature_gmail, mail_signature_at = now()
        `;
      } catch (err) {
        fail('mail_signature_cache', err);
      }
      if (got.signature) return NextResponse.json({ signature: got.signature, source: 'gmail', needsScope: false, saved });
      return NextResponse.json({ signature: saved, source: saved ? 'saved' : 'none', needsScope: false, gmailEmpty: true, saved });
    }
    return NextResponse.json({ signature: saved, source: saved ? 'saved' : 'none', needsScope: !!(got && got.needsScope) || !got, saved });
  } catch (err) {
    fail('mail_signature', err);
    return NextResponse.json({ signature: '', source: 'none', needsScope: false }, { status: 500 });
  }
}

/** POST { signature }: save a pasted signature (HTML or plain text) to owner_settings.mail_signature. */
export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!session.sql || !body) return NextResponse.json({ saved: false }, { status: session.sql ? 400 : 503 });
    await ensureMailBoard(session.sql);
    const signature = cleanMailHtml(String(body.signature || '')).slice(0, 20000);
    await session.sql`
      INSERT INTO owner_settings (owner_id, mail_signature)
      VALUES (${session.userId}, ${signature})
      ON CONFLICT (owner_id) DO UPDATE SET mail_signature = EXCLUDED.mail_signature
    `;
    return NextResponse.json({ saved: true, signature });
  } catch (err) {
    fail('mail_signature_save', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
