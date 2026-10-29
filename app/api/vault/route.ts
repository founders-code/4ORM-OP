import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { financeCodeOk, VAULT_COOKIE, vaultUnlockValue, vaultUnlocked } from '@/lib/finance';
import { fail } from '@/lib/log';
import { takeRateLimit } from '@/lib/rate-limit';
import { openBoard, sessionOwner } from '@/lib/session';
import { logVault } from '@/lib/vault-audit';

export const dynamic = 'force-dynamic';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/vault',
};

async function vaultSession() {
  const session = await openBoard();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const ownerId = await sessionOwner(session);
  if (!ownerId) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session, ownerId };
}

export async function GET() {
  try {
    const gate = await vaultSession();
    if ('error' in gate) return gate.error;
    if (!vaultUnlocked(cookies().get(VAULT_COOKIE)?.value, gate.session.userId)) {
      return NextResponse.json({ locked: true }, { status: 403 });
    }
    const ownerId = gate.ownerId;
    if (!gate.session.sql) return NextResponse.json({ docs: [], reason: 'no database url' });
    const empty = await gate.session.sql`SELECT 1 FROM vault_docs WHERE owner_id = ${ownerId} LIMIT 1`;
    if (!empty.length) {
      const { seedVaultDocs } = await import('@/lib/vault-seed');
      await seedVaultDocs(gate.session.sql, ownerId);
    }
    const docs = await gate.session.sql`
      SELECT id, org, kind, doc_id, name, version, status, verified_at, owner, note, source_url, drive_id, json_path
      FROM vault_docs WHERE owner_id = ${ownerId} ORDER BY name
    `;
    return NextResponse.json({ locked: false, docs: docs || [], reason: !docs || !docs.length ? 'no documents in the vault yet' : '' });
  } catch (err) {
    fail('vault_get', err);
    return NextResponse.json({ docs: [], reason: 'vault unavailable' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await vaultSession();
    if ('error' in gate) return gate.error;
    const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
    if (body.lock === true) {
      await logVault(gate.session.sql, gate.ownerId, 'Vault locked');
      const res = NextResponse.json({ locked: true });
      res.cookies.set(VAULT_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
      return res;
    }
    if (gate.session.sql && !(await takeRateLimit(gate.session.sql, 'vault-unlock', gate.session.userId, 3, 30))) {
      await logVault(gate.session.sql, gate.ownerId, 'Three wrong codes, 30-second wait started');
      return NextResponse.json({ locked: true, error: 'Too many tries. Wait 30 seconds.' }, { status: 429 });
    }
    if (!(await financeCodeOk(gate.session.sql, gate.ownerId, body.code))) {
      await logVault(gate.session.sql, gate.ownerId, 'Wrong code entered');
      return NextResponse.json({ locked: true, error: 'That code did not match.' }, { status: 403 });
    }
    const value = vaultUnlockValue(gate.session.userId);
    if (!value) return NextResponse.json({ error: 'Vault unlock is not configured.' }, { status: 503 });
    await logVault(gate.session.sql, gate.ownerId, 'Vault unlocked');
    const res = NextResponse.json({ locked: false });
    res.cookies.set(VAULT_COOKIE, value, COOKIE_OPTIONS);
    return res;
  } catch (err) {
    fail('vault_unlock', err);
    return NextResponse.json({ error: 'Vault is unavailable.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await openBoard();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ownerId = await sessionOwner(session);
    if (!ownerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.sql) return NextResponse.json({ saved: false }, { status: 503 });
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ saved: false }, { status: 400 });
    const owner = body?.owner != null ? String(body.owner) : null;
    const note = body?.note != null ? String(body.note) : null;
    if (owner != null) await session.sql`UPDATE vault_docs SET owner = ${owner} WHERE id = ${id} AND owner_id = ${ownerId}`;
    if (note != null) await session.sql`UPDATE vault_docs SET note = ${note} WHERE id = ${id} AND owner_id = ${ownerId}`;
    return NextResponse.json({ saved: true });
  } catch (err) {
    fail('vault_patch', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
