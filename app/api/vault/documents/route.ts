import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { VAULT_COOKIE, vaultUnlocked } from '@/lib/finance';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!vaultUnlocked(cookies().get(VAULT_COOKIE)?.value, session.userId)) {
      return NextResponse.json({ locked: true }, { status: 403 });
    }
    if (!session.sql) return NextResponse.json({ docs: [], reason: 'no database url' });
    const docs = await session.sql`
      SELECT id, org, kind, doc_id, name, version, status, verified_at, owner, note, source_url, drive_id, json_path
      FROM vault_docs WHERE owner_id = ${ownerId} ORDER BY name
    `;
    return NextResponse.json({
      docs: docs || [],
      reason: !docs || !docs.length ? 'no documents in the vault yet' : '',
    });
  } catch (err) {
    fail('vault_documents_get', err);
    return NextResponse.json({ docs: [], reason: 'vault unavailable' }, { status: 500 });
  }
}
