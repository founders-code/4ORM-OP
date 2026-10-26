import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { fail } from '@/lib/log';
import { isRoomEmail, openBoard, sessionEmail } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Person-specific signed documents (moved out of public/ so no URL serves them unauthenticated).
 * Each file names the one person who may read it besides Chad (ROOM_EMAIL). Everyone else gets 403.
 */
const FILES: Record<string, string> = {
  'dean-mnda.pdf': 'dean@4ormfinance.com',
  'dean-engagement-letter.pdf': 'dean@4ormfinance.com',
  'dean-comp-schedule.pdf': 'dean@4ormfinance.com',
};

export async function GET(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const name = String(new URL(req.url).searchParams.get('f') || '');
    const reader = FILES[name];
    if (!reader) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const email = await sessionEmail(session);
    if (!email || (!isRoomEmail(email) && email !== reader)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await readFile(join(process.cwd(), 'private-docs', name));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${name}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    fail('private_doc', err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
