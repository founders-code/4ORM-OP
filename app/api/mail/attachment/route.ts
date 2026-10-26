import { NextResponse } from 'next/server';
import { withCreds } from '@/lib/creds';
import { gmailAttachment } from '@/lib/google';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { loadCredsFor } from '@/lib/vault';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MESSAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;
const ATTACHMENT_ID = /^[A-Za-z0-9_-]{8,4096}$/;
const MAX_BYTES = 25 * 1024 * 1024;

/** A filename that is safe inside Content-Disposition (ASCII fallback plus RFC 5987 UTF-8 form). */
function disposition(name: string) {
  const clean = String(name || 'attachment').replace(/[\r\n"\\/]/g, ' ').trim().slice(0, 180) || 'attachment';
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

/**
 * GET /api/mail/attachment?mid=<gmail message id>&aid=<attachment id>&name=<filename>
 * Same-origin download of one Gmail attachment. Always served as a download (never rendered inline),
 * as application/octet-stream, with nosniff and a sandbox CSP, so a hostile file cannot run on this origin.
 */
export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const url = new URL(req.url);
    const mid = String(url.searchParams.get('mid') || '');
    const aid = String(url.searchParams.get('aid') || '');
    const name = String(url.searchParams.get('name') || 'attachment');
    if (!MESSAGE_ID.test(mid) || !ATTACHMENT_ID.test(aid)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    const creds = await loadCredsFor(session.userId);
    const bytes = await withCreds(creds, () => gmailAttachment(mid, aid)).catch((err) => {
      fail('mail_attachment', err);
      return null;
    });
    if (!bytes) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'Attachment is too large to download here.' }, { status: 413 });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': disposition(name),
        'content-length': String(bytes.length),
        'x-content-type-options': 'nosniff',
        'content-security-policy': "sandbox; default-src 'none'",
        'cache-control': 'private, no-store',
      },
    });
  } catch (err) {
    fail('mail_attachment', err);
    return NextResponse.json({ error: 'Attachment is unavailable.' }, { status: 500 });
  }
}
