import { readFileSync } from 'fs';
import path from 'path';
import { createDecipheriv } from 'crypto';
import { gunzipSync } from 'zlib';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { VAULT_COOKIE, vaultUnlocked } from '@/lib/finance';
import { fail } from '@/lib/log';
import { openBoard, sessionOwner } from '@/lib/session';
import { logVault } from '@/lib/vault-audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* The Library: every skill, house rule, design rule and process, filed into the Vault.
   The bundle ships encrypted (data/library.enc, AES-256-GCM); the key is sent once by Chad's own unlocked
   session and never stored. Entries are upserted by doc_id, so a re-import updates them in place. */
type Item = { doc_id: string; org: string; kind: string; name: string; version: string; note: string };

export async function POST(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!vaultUnlocked(cookies().get(VAULT_COOKIE)?.value, session.userId)) return NextResponse.json({ locked: true }, { status: 403 });
    if (!session.sql) return NextResponse.json({ error: 'No database' }, { status: 503 });
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    const key = String(body.key || '');
    if (!/^[0-9a-f]{64}$/.test(key)) return NextResponse.json({ error: 'Bad key' }, { status: 400 });
    const blob = readFileSync(path.join(process.cwd(), 'data/library.enc'));
    const iv = blob.subarray(0, 12), tag = blob.subarray(blob.length - 16), ct = blob.subarray(12, blob.length - 16);
    const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    d.setAuthTag(tag);
    const items = JSON.parse(gunzipSync(Buffer.concat([d.update(ct), d.final()])).toString('utf8')) as Item[];
    let n = 0;
    for (const it of items) {
      const docId = String(it.doc_id || '').slice(0, 120);
      if (!docId) continue;
      const up = await session.sql`UPDATE vault_docs SET org = ${it.org}, kind = ${it.kind}, name = ${String(it.name).slice(0, 300)}, version = ${it.version},
          status = 'Current', verified_at = now(), note = ${it.note}, owner = COALESCE(owner, 'Chad')
        WHERE owner_id = ${ownerId} AND doc_id = ${docId} RETURNING id`;
      if (!up.length) {
        await session.sql`INSERT INTO vault_docs (owner_id, org, kind, doc_id, name, version, status, verified_at, owner, note)
          VALUES (${ownerId}, ${it.org}, ${it.kind}, ${docId}, ${String(it.name).slice(0, 300)}, ${it.version}, 'Current', now(), 'Chad', ${it.note})`;
      }
      n += 1;
    }
    await logVault(session.sql, ownerId, `Library filed: ${n} entries`);
    return NextResponse.json({ ok: true, filed: n });
  } catch (err) {
    fail('vault_library', err);
    return NextResponse.json({ error: 'Could not file the library' }, { status: 500 });
  }
}
