import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await sessionOwner(session))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!session.sql || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    }
    const rows = await session.sql`
      SELECT name, mime, body_b64 FROM staged_docs WHERE id = ${id} AND owner_id = ${session.userId}
    `;
    const row = rows[0] as { mime?: string; body_b64?: string } | undefined;
    const mime = String(row?.mime || '');
    const previewable = mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/');
    const raw = String(row?.body_b64 || '');
    if (!raw || !previewable) return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    const bytes = Buffer.from(raw, 'base64');
    // Stored text (including text/html) is shown as plain text, and everything except PDF gets a sandbox CSP,
    // so an uploaded HTML or SVG file can never run script on this origin (the viewer iframes this route).
    const type = mime.startsWith('text/') ? 'text/plain; charset=utf-8' : mime;
    const headers: Record<string, string> = { 'content-type': type, 'content-disposition': 'inline', 'x-content-type-options': 'nosniff' };
    if (mime !== 'application/pdf') headers['content-security-policy'] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
    return new NextResponse(new Uint8Array(bytes), { headers });
  } catch (err) {
    fail('staged_file', err);
    return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 500 });
  }
}
