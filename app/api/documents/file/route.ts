import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { openBoard } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!session.sql || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    }
    const rows = await session.sql`
      SELECT name, mime, body_b64 FROM staged_docs WHERE id = ${id} AND owner_id = ${session.userId}
    `;
    const row = rows[0] as { mime?: string; body_b64?: string } | undefined;
    const raw = String(row?.body_b64 || '');
    if (!raw) return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
    const bytes = Buffer.from(raw, 'base64');
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'content-type': String(row?.mime || 'application/octet-stream'), 'content-disposition': 'inline' },
    });
  } catch (err) {
    fail('staged_file', err);
    return NextResponse.json({ error: 'This file cannot be previewed here.' }, { status: 400 });
  }
}
